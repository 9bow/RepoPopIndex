// Cache key namespaces (Upstash Redis):
//   rpi:report:{platform}:{owner}/{repo}:{period}   — canonical analysis report
//   rpi:progress:{analysisId}                        — in-flight progress updates
//   rpi:rate:{source}                                — per-source rate-limit counters
//   rpi:social:{source}:{platform}:{owner}/{repo}:{period} — per-collector cache
//   rpi:social:metrics:{analysisId}                  — dark-launch social metrics blob
//   rpi:social:reddit:token{,:lock}                  — Reddit OAuth token + refresh lock
//   rpi:social:youtube:quota-exhausted:{YYYY-MM-DD}  — YouTube quota circuit breaker

import { redis } from "./rate-limiter";

export async function cacheGet<T>(key: string): Promise<T | null> {
  const value = await redis.get<T>(key);
  return value;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  await redis.set(key, value, { ex: ttlSeconds });
}

export function reportCacheKey(
  platform: string,
  owner: string,
  repo: string,
  period: string
): string {
  return `rpi:report:${platform}:${owner}/${repo}:${period}`;
}

export function progressCacheKey(analysisId: string): string {
  return `rpi:progress:${analysisId}`;
}

// Completed reports are immutable — score and metrics never change after
// analysis finishes. With Redis-only storage they are the canonical record,
// so we keep them for 30 days to match analysis record retention.
export const REPORT_TTL = 30 * 24 * 3600;
export const PROGRESS_TTL = 600;
