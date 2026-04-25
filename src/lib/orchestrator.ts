import { cacheSet, progressCacheKey, PROGRESS_TTL, reportCacheKey, REPORT_TTL } from "./cache";
import { dequeue } from "./queue";
import { getAnalysis, updateAnalysisStatus } from "./analysis-store";
import type { AnalysisReport, AnalysisStatus, CollectorResult, Period, Platform, ProgressUpdate } from "./types";

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
  await updateAnalysisStatus(analysisId, { status });

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

    await updateStatus(analysisId, "scoring", 80, "Computing scores...");

    const { computeScores } = await import("./scoring/composite-score");
    const scoreResult = computeScores(collectorResults, platform);

    await updateStatus(analysisId, "scoring", 90, "Storing scores...");

    // Extract HN display data from collector results so the report API can
    // read it directly from the cached report.
    const hnCollector = collectorResults.find((cr) => cr.source === "hackernews");
    const hnMetrics = hnCollector?.metrics ?? [];
    const hnData = hnMetrics.length > 0 ? {
      storyCount: hnMetrics.find((m) => m.metricKey === "story_count")?.rawValue ?? 0,
      totalPoints: hnMetrics.find((m) => m.metricKey === "total_points")?.rawValue ?? 0,
      totalComments: hnMetrics.find((m) => m.metricKey === "total_comments")?.rawValue ?? 0,
      topStory: (hnMetrics.find((m) => m.metricKey === "top_story")?.rawJson ?? null) as {
        title: string; url: string; points: number;
      } | null,
      engagement: hnMetrics.find((m) => m.metricKey === "engagement")?.rawValue ?? 0,
    } : null;

    const hasEnoughData = scoreResult.excludedCategories.length <
      Object.keys(scoreResult.categoryScores).length;
    const finalStatus: AnalysisStatus = hasEnoughData ? "complete" : "partial";

    const hasAnyFailed = collectorResults.length === 0;
    const effectiveStatus: AnalysisStatus = hasAnyFailed ? "failed" : finalStatus;

    const completedAt = new Date().toISOString();
    const existing = await getAnalysis(analysisId);

    const report: AnalysisReport = {
      id: analysisId,
      platform,
      owner,
      repo,
      period,
      status: effectiveStatus,
      compositeScore: scoreResult.compositeScore,
      categoryScores: scoreResult.categoryScores,
      excludedCategories: scoreResult.excludedCategories,
      starQuality: scoreResult.starQuality,
      socialBuzz: { hn: hnData },
      createdAt: existing?.createdAt ?? completedAt,
      completedAt,
    };

    await cacheSet(
      reportCacheKey(platform, owner, repo, period),
      report,
      REPORT_TTL
    );

    await updateAnalysisStatus(analysisId, { status: effectiveStatus, completedAt });

    await updateStatus(analysisId, effectiveStatus, 100, effectiveStatus);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await updateAnalysisStatus(analysisId, {
      status: "failed",
      error: message,
      completedAt: new Date().toISOString(),
    });
    await updateStatus(analysisId, "failed", 0, message);
  } finally {
    clearTimeout(totalTimer);
    await dequeue(analysisId);
  }
}
