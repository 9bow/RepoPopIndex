import { db } from "@/db";
import { analyses, rawMetrics, scores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cacheSet, progressCacheKey, PROGRESS_TTL } from "./cache";
import { dequeue } from "./queue";
import type { AnalysisStatus, CollectorResult, Period, Platform, ProgressUpdate } from "./types";

interface AnalysisParams {
  analysisId: string;
  platform: Platform;
  owner: string;
  repo: string;
  period: Period;
}

async function updateStatus(
  analysisId: string,
  status: AnalysisStatus,
  progress: number,
  stage: string
): Promise<void> {
  await db
    .update(analyses)
    .set({ status })
    .where(eq(analyses.id, analysisId));

  const update: ProgressUpdate = { status, progress, stage };
  await cacheSet(progressCacheKey(analysisId), update, PROGRESS_TTL);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

const COLLECTOR_TIMEOUT = 15_000;
const TOTAL_TIMEOUT = 60_000;

export async function runAnalysis(params: AnalysisParams): Promise<void> {
  const { analysisId, platform, owner, repo, period } = params;

  const totalTimer = setTimeout(() => {
    updateStatus(analysisId, "failed", 0, "Total timeout exceeded").catch(() => {});
  }, TOTAL_TIMEOUT);

  try {
    await updateStatus(analysisId, "collecting", 5, "Starting collectors...");

    const collectorResults: CollectorResult[] = [];

    if (platform === "github") {
      const [
        { collectGitHubGraphQL },
        { collectGitHubSearch },
        { collectGitHubRest },
        { collectGitHubDependents },
        { analyzeStarQuality },
      ] = await Promise.all([
        import("./collectors/github-graphql"),
        import("./collectors/github-search"),
        import("./collectors/github-rest"),
        import("./collectors/github-scraper"),
        import("./collectors/star-quality"),
      ]);

      await updateStatus(analysisId, "collecting", 10, "Collecting GitHub metrics...");

      const settled = await Promise.allSettled([
        withTimeout(collectGitHubGraphQL(owner, repo, period), COLLECTOR_TIMEOUT)
          .then(async (r) => { await updateStatus(analysisId, "collecting", 15, "GitHub GraphQL done"); return r; }),
        withTimeout(collectGitHubSearch(owner, repo, period), COLLECTOR_TIMEOUT)
          .then(async (r) => { await updateStatus(analysisId, "collecting", 30, "GitHub Search done"); return r; }),
        withTimeout(collectGitHubRest(owner, repo, period), COLLECTOR_TIMEOUT)
          .then(async (r) => { await updateStatus(analysisId, "collecting", 40, "GitHub REST done"); return r; }),
        withTimeout(collectGitHubDependents(owner, repo), COLLECTOR_TIMEOUT)
          .then(async (r) => { await updateStatus(analysisId, "collecting", 45, "Dependents done"); return r; }),
        withTimeout(analyzeStarQuality(owner, repo), COLLECTOR_TIMEOUT)
          .then(async (r) => { await updateStatus(analysisId, "collecting", 65, "Star quality done"); return r; }),
      ]);

      for (const result of settled) {
        if (result.status === "fulfilled") {
          collectorResults.push(result.value);
        }
      }
    } else {
      const { collectHuggingFace } = await import("./collectors/huggingface");
      await updateStatus(analysisId, "collecting", 10, "Collecting HuggingFace metrics...");

      const hfResult = await withTimeout(
        collectHuggingFace(owner, repo, period),
        COLLECTOR_TIMEOUT
      ).catch(() => null);

      if (hfResult) collectorResults.push(hfResult);
      await updateStatus(analysisId, "collecting", 55, "HuggingFace done");
    }

    const { collectHackerNews } = await import("./collectors/hackernews");
    const hnResult = await withTimeout(
      collectHackerNews(platform, owner, repo, period),
      COLLECTOR_TIMEOUT
    ).catch(() => null);

    if (hnResult) collectorResults.push(hnResult);
    await updateStatus(analysisId, "collecting", 65, "Social buzz done");

    await updateStatus(analysisId, "collecting", 70, "Storing raw metrics...");

    const metricsToInsert = collectorResults.flatMap((cr) =>
      cr.metrics.map((m) => ({
        analysisId,
        source: cr.source,
        category: m.category,
        metricKey: m.metricKey,
        rawValue: m.rawValue,
        rawJson: m.rawJson ?? null,
      }))
    );

    if (metricsToInsert.length > 0) {
      await db.insert(rawMetrics).values(metricsToInsert);
    }

    await updateStatus(analysisId, "scoring", 80, "Computing scores...");

    const { computeScores } = await import("./scoring/composite-score");
    const scoreResult = computeScores(collectorResults, platform);

    await updateStatus(analysisId, "scoring", 90, "Storing scores...");

    await db.insert(scores).values({
      analysisId,
      compositeScore: scoreResult.compositeScore,
      categoryScores: scoreResult.categoryScores,
      metricScores: scoreResult.metricScores,
      excludedCategories: scoreResult.excludedCategories,
      starQualityFactor: scoreResult.starQuality?.factor ?? null,
      starQualityRecent: scoreResult.starQuality?.recent ?? null,
      starQualityHistorical: scoreResult.starQuality?.historical ?? null,
      starBurstDetected: scoreResult.starQuality?.burstDetected ? 1 : 0,
    });

    const hasEnoughData = scoreResult.excludedCategories.length <
      Object.keys(scoreResult.categoryScores).length;
    const finalStatus: AnalysisStatus = hasEnoughData ? "complete" : "partial";

    const hasAnyFailed = collectorResults.length === 0;
    const effectiveStatus: AnalysisStatus = hasAnyFailed ? "failed" : finalStatus;

    await db
      .update(analyses)
      .set({ status: effectiveStatus, completedAt: new Date() })
      .where(eq(analyses.id, analysisId));

    await updateStatus(analysisId, effectiveStatus, 100, effectiveStatus);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await db
      .update(analyses)
      .set({ status: "failed", error: message, completedAt: new Date() })
      .where(eq(analyses.id, analysisId));
    await updateStatus(analysisId, "failed", 0, message);
  } finally {
    clearTimeout(totalTimer);
    await dequeue(analysisId);
  }
}
