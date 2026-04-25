import type { CollectorResult } from "@/lib/types";
import type { SocialSource } from "./cache-key";

export type EmptyReason =
  | "unconfigured"
  | "precision_gate_failed"
  | "auth_failed"
  | "quota_exhausted"
  | "rate_limited"
  | "fetch_error"
  | "timeout";

export function emptySocialResult(
  source: SocialSource,
  reason: EmptyReason,
  metricKeys: readonly string[]
): CollectorResult {
  return {
    source,
    metrics: metricKeys.map((metricKey) => ({
      category: "S1",
      metricKey,
      rawValue: 0,
    })),
    error: reason,
  };
}

export const REDDIT_METRIC_KEYS = [
  "reddit_post_count",
  "reddit_score_sum",
  "reddit_comment_sum",
] as const;

export const STACKOVERFLOW_METRIC_KEYS = [
  "so_question_count",
  "so_answered_ratio",
  "so_score_sum",
] as const;

export const YOUTUBE_METRIC_KEYS = [
  "youtube_video_count",
  "youtube_view_sum",
  "youtube_like_sum",
] as const;

export interface SocialSourceBlob {
  metrics: Record<string, number>;
  reason: string | null;
}

export interface SocialMetricsBlob {
  S1: {
    reddit: SocialSourceBlob;
    stackoverflow: SocialSourceBlob;
    youtube: SocialSourceBlob;
  };
  collectedAt: string;
}
