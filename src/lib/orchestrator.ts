import {
  cacheGet,
  cacheSet,
  progressCacheKey,
  PROGRESS_TTL,
  pushRecentReport,
  reportCacheKey,
  REPORT_TTL,
} from "./cache";
import { dequeue } from "./queue";
import { getAnalysis, updateAnalysisStatus } from "./analysis-store";
import { writeSocialMetrics } from "./social-metrics-store";
import { socialCacheKey } from "./collectors/_shared/cache-key";
import type {
  AnalysisReport,
  AnalysisStatus,
  CollectorResult,
  PartialInfo,
  PartialReason,
  Period,
  Platform,
  ProgressUpdate,
  SocialBuzzReddit,
  SocialBuzzStackOverflow,
  SocialBuzzYouTube,
} from "./types";

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
        { collectPackageDownloads },
      ] = await Promise.all([
        import("./collectors/github-graphql"),
        import("./collectors/github-search"),
        import("./collectors/github-rest"),
        import("./collectors/github-scraper"),
        import("./collectors/star-quality"),
        import("./collectors/package-downloads"),
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
        withTimeout(collectPackageDownloads(owner, repo), COLLECTOR_TIMEOUT)
          .then(async (r) => { await updateStatus(analysisId, "collecting", 67, "Package downloads done"); return r; }),
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

    // Social buzz: run HN (existing) in parallel with the dark-launched
    // Reddit/SO/YouTube group. New collectors persist a separate Redis blob
    // (rpi:social:metrics:{analysisId}); their metric keys are not registered
    // in *_METRICS so computeScores ignores them — the report API surface is
    // unchanged during dark-launch.
    const [
      { collectHackerNews },
      { collectReddit },
      { collectStackOverflow },
      { collectYouTube },
    ] = await Promise.all([
      import("./collectors/hackernews"),
      import("./collectors/reddit"),
      import("./collectors/stackoverflow"),
      import("./collectors/youtube"),
    ]);

    const socialSettled = await Promise.allSettled([
      withTimeout(collectHackerNews(platform, owner, repo, period), COLLECTOR_TIMEOUT),
      withTimeout(collectReddit(platform, owner, repo, period), COLLECTOR_TIMEOUT),
      withTimeout(collectStackOverflow(platform, owner, repo, period), COLLECTOR_TIMEOUT),
      withTimeout(collectYouTube(platform, owner, repo, period), COLLECTOR_TIMEOUT),
    ]);

    const socialSourceNames = ["hackernews", "reddit", "stackoverflow", "youtube"] as const;
    type SocialSourceName = (typeof socialSourceNames)[number];
    const socialResults: CollectorResult[] = [];
    const backupSources: SocialSourceName[] = [];
    const failedSources: { source: SocialSourceName; reason: PartialReason }[] = [];

    for (let i = 0; i < socialSettled.length; i++) {
      const s = socialSettled[i];
      const sourceName = socialSourceNames[i];

      // Successful fulfilment with no error → take it as-is.
      if (s.status === "fulfilled" && !s.value.error) {
        collectorResults.push(s.value);
        socialResults.push(s.value);
        continue;
      }

      // Determine reason for the original failure.
      const errorReason: PartialReason =
        s.status === "fulfilled" &&
        (s.value.error === "rate_limited" || s.value.error === "rate_limit")
          ? "rate_limit"
          : "collector_error";

      // Stale fallback: try the rolling per-source cache (30d TTL).
      // Only reddit/stackoverflow/youtube use socialCacheKey; HN has no
      // dedicated cache, so failure there cannot be backfilled.
      const backup =
        sourceName === "hackernews"
          ? null
          : await cacheGet<CollectorResult>(
              socialCacheKey(sourceName, platform, owner, repo, period)
            ).catch(() => null);

      if (backup && !backup.error && backup.metrics.length > 0) {
        collectorResults.push(backup);
        socialResults.push(backup);
        backupSources.push(sourceName);
      } else {
        // No backup available: record source as missing, omit from scoring.
        failedSources.push({ source: sourceName, reason: errorReason });
        if (s.status === "fulfilled") {
          // Still pass the empty result through so social-metrics-store records the reason.
          socialResults.push(s.value);
        }
      }
    }

    // Dark-launch persistence: write Reddit/SO/YouTube metrics to a
    // dedicated Redis blob. Failure here must not abort the analysis.
    try {
      await writeSocialMetrics(analysisId, socialResults);
    } catch {
      /* dark-launch best-effort */
    }

    await updateStatus(analysisId, "collecting", 70, "Social buzz done");

    await updateStatus(analysisId, "scoring", 80, "Computing scores...");

    const { computeScores } = await import("./scoring/composite-score");
    const scoreResult = computeScores(collectorResults, platform);

    await updateStatus(analysisId, "scoring", 90, "Storing scores...");

    // Extract per-source display data from collector results so the report API can
    // read it directly from the cached report.
    const hnCollector = collectorResults.find((cr) => cr.source === "hackernews");
    const hnMetrics = hnCollector?.metrics ?? [];
    const hnData = hnMetrics.length > 0 && !hnCollector?.error ? {
      storyCount: hnMetrics.find((m) => m.metricKey === "story_count")?.rawValue ?? 0,
      totalPoints: hnMetrics.find((m) => m.metricKey === "total_points")?.rawValue ?? 0,
      totalComments: hnMetrics.find((m) => m.metricKey === "total_comments")?.rawValue ?? 0,
      topStory: (hnMetrics.find((m) => m.metricKey === "top_story")?.rawJson ?? null) as {
        title: string; url: string; points: number;
      } | null,
      engagement: hnMetrics.find((m) => m.metricKey === "engagement")?.rawValue ?? 0,
    } : null;

    function rawNum(source: string, key: string): number | undefined {
      const cr = collectorResults.find((r) => r.source === source);
      if (!cr || cr.error) return undefined;
      const m = cr.metrics.find((mm) => mm.metricKey === key);
      return typeof m?.rawValue === "number" ? m.rawValue : undefined;
    }

    const redditData: SocialBuzzReddit | null = (() => {
      const post_count = rawNum("reddit", "reddit_post_count");
      const score_sum = rawNum("reddit", "reddit_score_sum");
      const comment_sum = rawNum("reddit", "reddit_comment_sum");
      if (post_count === undefined && score_sum === undefined && comment_sum === undefined) return null;
      return { post_count, score_sum, comment_sum };
    })();

    const stackoverflowData: SocialBuzzStackOverflow | null = (() => {
      // Collector exposes question_count/answered_ratio/score_sum; the report
      // shape is question/answer-flavored. Surface only the fields that align
      // unambiguously (score_sum); leave answer_count / view_sum undefined.
      const score_sum = rawNum("stackoverflow", "so_score_sum");
      const answer_count = rawNum("stackoverflow", "so_question_count");
      if (answer_count === undefined && score_sum === undefined) return null;
      return { answer_count, score_sum };
    })();

    const youtubeData: SocialBuzzYouTube | null = (() => {
      const video_count = rawNum("youtube", "youtube_video_count");
      const view_sum = rawNum("youtube", "youtube_view_sum");
      const like_sum = rawNum("youtube", "youtube_like_sum");
      if (video_count === undefined && view_sum === undefined && like_sum === undefined) return null;
      return { video_count, view_sum, like_sum };
    })();

    // Aggregate partial info: served_from_backup + per-source failures.
    const missingSources: string[] = [
      ...backupSources,
      ...failedSources.map((f) => f.source),
    ];
    let partialReason: PartialReason | null = null;
    if (failedSources.some((f) => f.reason === "rate_limit")) partialReason = "rate_limit";
    else if (failedSources.length > 0) partialReason = "collector_error";
    else if (backupSources.length > 0) partialReason = "served_from_backup";
    const partialInfo: PartialInfo | null =
      partialReason !== null && missingSources.length > 0
        ? { reason: partialReason, missingSources }
        : null;

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
      socialBuzz: {
        hn: hnData,
        reddit: redditData,
        stackoverflow: stackoverflowData,
        youtube: youtubeData,
      },
      scoreVersion: "v2",
      partial: partialInfo,
      createdAt: existing?.createdAt ?? completedAt,
      completedAt,
    };

    await cacheSet(
      reportCacheKey(platform, owner, repo, period),
      report,
      REPORT_TTL
    );

    // Phase 4: rolling list of recent finalized reports for the home page.
    // Best-effort — list write must not abort an otherwise-successful analysis.
    if (effectiveStatus === "complete" || effectiveStatus === "partial") {
      try {
        await pushRecentReport({
          platform,
          owner,
          repo,
          period,
          score: report.compositeScore,
          scoreVersion: "v2",
          completedAt,
        });
      } catch {
        /* best-effort */
      }
    }

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
