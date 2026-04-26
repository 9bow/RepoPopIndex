export type SocialSource = "reddit" | "stackoverflow" | "youtube";

export function socialCacheKey(
  source: SocialSource,
  platform: string,
  owner: string,
  repo: string,
  period: string
): string {
  return `rpi:social:${source}:${platform}:${owner}/${repo}:${period}`;
}

export function socialMetricsKey(analysisId: string): string {
  return `rpi:social:metrics:${analysisId}`;
}

export const REDDIT_TOKEN_KEY = "rpi:social:reddit:token";
export const REDDIT_TOKEN_LOCK_KEY = "rpi:social:reddit:token:lock";
export const YOUTUBE_QUOTA_BREAKER_PREFIX = "rpi:social:youtube:quota-exhausted";

// Extended to 30 days so a recent successful collection can serve as a stale
// backup when the live call fails (rate limit / collector error).
export const SOCIAL_CACHE_TTL_SECONDS = 30 * 24 * 3600;
export const SOCIAL_METRICS_TTL_SECONDS = 30 * 24 * 3600;
