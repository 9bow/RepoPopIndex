import { cacheGet, cacheSet } from "./cache";
import { socialMetricsKey, SOCIAL_METRICS_TTL_SECONDS } from "./collectors/_shared/cache-key";
import type { SocialMetricsBlob, SocialSourceBlob } from "./collectors/_shared/types";
import type { CollectorResult } from "./types";

function extractSource(
  results: CollectorResult[],
  source: string,
  metricKeys: readonly string[]
): SocialSourceBlob {
  const cr = results.find((r) => r.source === source);
  const metrics: Record<string, number> = {};
  for (const key of metricKeys) {
    const m = cr?.metrics.find((x) => x.metricKey === key);
    metrics[key] = typeof m?.rawValue === "number" ? m.rawValue : 0;
  }
  return { metrics, reason: cr?.error ?? null };
}

export async function writeSocialMetrics(
  analysisId: string,
  collectorResults: CollectorResult[]
): Promise<void> {
  const blob: SocialMetricsBlob = {
    S1: {
      reddit: extractSource(collectorResults, "reddit", [
        "reddit_post_count",
        "reddit_score_sum",
        "reddit_comment_sum",
      ]),
      stackoverflow: extractSource(collectorResults, "stackoverflow", [
        "so_question_count",
        "so_answered_ratio",
        "so_score_sum",
      ]),
      youtube: extractSource(collectorResults, "youtube", [
        "youtube_video_count",
        "youtube_view_sum",
        "youtube_like_sum",
      ]),
    },
    collectedAt: new Date().toISOString(),
  };

  await cacheSet(socialMetricsKey(analysisId), blob, SOCIAL_METRICS_TTL_SECONDS);
}

export async function readSocialMetrics(
  analysisId: string
): Promise<SocialMetricsBlob | null> {
  return cacheGet<SocialMetricsBlob>(socialMetricsKey(analysisId));
}
