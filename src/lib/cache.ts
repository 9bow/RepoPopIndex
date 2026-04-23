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
// analysis finishes. 24 h is safe and cuts unnecessary DB re-reads.
export const REPORT_TTL = 86_400;
export const PROGRESS_TTL = 600;
