// Cache key namespaces (Upstash Redis):
//   rpi:report:{platform}:{owner}/{repo}:{period}   — canonical analysis report
//   rpi:progress:{analysisId}                        — in-flight progress updates
//   rpi:rate:{source}                                — per-source rate-limit counters
//   rpi:social:{source}:{platform}:{owner}/{repo}:{period} — per-collector cache
//   rpi:social:metrics:{analysisId}                  — dark-launch social metrics blob
//   rpi:social:reddit:token{,:lock}                  — Reddit OAuth token + refresh lock
//   rpi:social:youtube:quota-exhausted:{YYYY-MM-DD}  — YouTube quota circuit breaker
//   rpi:recent:reports                               — list of recent finalized reports (LPUSH/LTRIM)

import { redis } from "./rate-limiter";
import type { Period, Platform, ScoreVersion } from "./types";

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

// Recent reports list (Phase 4): rolling window of the last finalized analyses,
// shown on the home page. Capped at 20 entries server-side, exposed up to 12.
export const RECENT_REPORTS_KEY = "rpi:recent:reports";
const RECENT_REPORTS_MAX = 20;
const RECENT_REPORTS_LIMIT_CAP = 12;

export interface RecentReportEntry {
  platform: Platform;
  owner: string;
  repo: string;
  period: Period;
  score: number;
  scoreVersion: ScoreVersion;
  completedAt: string;
  // Stable identity for dedupe across re-runs of the same {platform,owner,repo,period}.
  dedupeKey: string;
}

export function recentReportDedupeKey(
  platform: string,
  owner: string,
  repo: string,
  period: string
): string {
  return `${platform}:${owner}/${repo}:${period}`;
}

export async function pushRecentReport(
  payload: Omit<RecentReportEntry, "dedupeKey">
): Promise<void> {
  const dedupeKey = recentReportDedupeKey(
    payload.platform,
    payload.owner,
    payload.repo,
    payload.period
  );
  const entry: RecentReportEntry = { ...payload, dedupeKey };

  // Remove any prior entry for the same {platform,owner,repo,period} by reading
  // the current list and LREM-ing exact matches. Avoids needing a separate index.
  const existing = await redis.lrange<RecentReportEntry | string>(
    RECENT_REPORTS_KEY,
    0,
    RECENT_REPORTS_MAX - 1
  );
  for (const raw of existing) {
    const parsed: RecentReportEntry | null =
      typeof raw === "string" ? safeParseEntry(raw) : (raw as RecentReportEntry);
    if (parsed?.dedupeKey === dedupeKey) {
      // LREM with the exact stored value. Upstash auto-serializes objects, so
      // we pass the same object shape.
      await redis.lrem(RECENT_REPORTS_KEY, 0, raw as never);
    }
  }

  await redis.lpush(RECENT_REPORTS_KEY, entry);
  await redis.ltrim(RECENT_REPORTS_KEY, 0, RECENT_REPORTS_MAX - 1);
}

export async function getRecentReports(
  limit: number
): Promise<RecentReportEntry[]> {
  const cap = Math.min(Math.max(0, limit), RECENT_REPORTS_LIMIT_CAP);
  if (cap === 0) return [];
  const raw = await redis.lrange<RecentReportEntry | string>(
    RECENT_REPORTS_KEY,
    0,
    cap - 1
  );
  const out: RecentReportEntry[] = [];
  for (const item of raw) {
    const parsed =
      typeof item === "string" ? safeParseEntry(item) : (item as RecentReportEntry);
    if (parsed) out.push(parsed);
  }
  return out;
}

function safeParseEntry(raw: string): RecentReportEntry | null {
  try {
    return JSON.parse(raw) as RecentReportEntry;
  } catch {
    return null;
  }
}
