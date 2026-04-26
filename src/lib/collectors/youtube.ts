import type { CollectorResult, Period, Platform } from "@/lib/types";
import { periodToSinceDate } from "@/lib/types";
import { fetchWithRetry } from "@/lib/retry";
import { cacheGet, cacheSet } from "@/lib/cache";
import { redis } from "@/lib/rate-limiter";
import {
  socialCacheKey,
  SOCIAL_CACHE_TTL_SECONDS,
  YOUTUBE_QUOTA_BREAKER_PREFIX,
} from "@/lib/collectors/_shared/cache-key";
import {
  emptySocialResult,
  YOUTUBE_METRIC_KEYS,
} from "@/lib/collectors/_shared/types";

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

let _warnedMissingKey = false;

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0
    )
  );
  return Math.max(60, Math.floor((next.getTime() - now.getTime()) / 1000));
}

function utcDateKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function isQuotaError(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const err = (body as Record<string, unknown>).error;
  if (typeof err !== "object" || err === null) return false;
  const errors = (err as Record<string, unknown>).errors;
  if (!Array.isArray(errors)) return false;
  return errors.some((e) => {
    const reason = (e as Record<string, unknown>).reason;
    return reason === "quotaExceeded" || reason === "dailyLimitExceeded";
  });
}

export async function collectYouTube(
  platform: Platform,
  owner: string,
  repo: string,
  period: Period
): Promise<CollectorResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    if (!_warnedMissingKey) {
      console.warn("[youtube] YOUTUBE_API_KEY not set — collector disabled");
      _warnedMissingKey = true;
    }
    return emptySocialResult("youtube", "unconfigured", YOUTUBE_METRIC_KEYS);
  }

  const cacheKey = socialCacheKey("youtube", platform, owner, repo, period);
  const cached = await cacheGet<CollectorResult>(cacheKey);
  if (cached) return cached;

  const breakerKey = `${YOUTUBE_QUOTA_BREAKER_PREFIX}:${utcDateKey()}`;
  const broken = await redis.get(breakerKey);
  if (broken) {
    return emptySocialResult("youtube", "quota_exhausted", YOUTUBE_METRIC_KEYS);
  }

  const slug =
    platform === "github"
      ? `github.com/${owner}/${repo}`
      : `huggingface.co/${owner}/${repo}`;

  const since = periodToSinceDate(period);
  const publishedAfter = since.toISOString();

  const searchUrl =
    `${YOUTUBE_SEARCH_URL}?part=snippet&type=video` +
    `&q=${encodeURIComponent('"' + owner + "/" + repo + '"')}` +
    `&publishedAfter=${publishedAfter}&maxResults=50&key=${apiKey}`;

  let searchBody: unknown;
  try {
    const res = await fetchWithRetry(searchUrl);
    if (res.status === 403) {
      const body = await res.json();
      if (isQuotaError(body)) {
        await redis.set(breakerKey, "1", { ex: secondsUntilUtcMidnight() });
        return emptySocialResult(
          "youtube",
          "quota_exhausted",
          YOUTUBE_METRIC_KEYS
        );
      }
      return emptySocialResult("youtube", "fetch_error", YOUTUBE_METRIC_KEYS);
    }
    if (!res.ok) {
      return emptySocialResult("youtube", "fetch_error", YOUTUBE_METRIC_KEYS);
    }
    searchBody = await res.json();
  } catch {
    return emptySocialResult("youtube", "fetch_error", YOUTUBE_METRIC_KEYS);
  }

  type SearchItem = {
    id?: { videoId?: string };
    snippet?: { title?: string; description?: string };
  };
  const items: SearchItem[] =
    (
      searchBody as Record<string, unknown>
    ).items as SearchItem[] ?? [];

  const filteredIds = items
    .filter((item) => {
      const title = item.snippet?.title ?? "";
      const desc = item.snippet?.description ?? "";
      return title.includes(slug) || desc.includes(slug);
    })
    .map((item) => item.id?.videoId ?? "")
    .filter(Boolean);

  const videoCount = filteredIds.length;

  if (videoCount === 0) {
    const result: CollectorResult = {
      source: "youtube",
      metrics: [
        { category: "S1", metricKey: "youtube_video_count", rawValue: 0 },
        { category: "S1", metricKey: "youtube_view_sum", rawValue: 0 },
        { category: "S1", metricKey: "youtube_like_sum", rawValue: 0 },
      ],
    };
    await cacheSet(cacheKey, result, SOCIAL_CACHE_TTL_SECONDS);
    return result;
  }

  const idsCsv = filteredIds.join(",");
  const videosUrl = `${YOUTUBE_VIDEOS_URL}?part=statistics&id=${idsCsv}&key=${apiKey}`;

  let viewSum = 0;
  let likeSum = 0;
  let videosError: string | undefined;

  try {
    const res = await fetchWithRetry(videosUrl);
    if (res.status === 403) {
      const body = await res.json();
      if (isQuotaError(body)) {
        const partial: CollectorResult = {
          source: "youtube",
          metrics: [
            {
              category: "S1",
              metricKey: "youtube_video_count",
              rawValue: videoCount,
            },
            { category: "S1", metricKey: "youtube_view_sum", rawValue: 0 },
            { category: "S1", metricKey: "youtube_like_sum", rawValue: 0 },
          ],
          error: "quota_exhausted",
        };
        return partial;
      }
      videosError = "fetch_error";
    } else if (!res.ok) {
      videosError = "fetch_error";
    } else {
      type VideoItem = {
        statistics?: { viewCount?: string; likeCount?: string };
      };
      const videosBody = (await res.json()) as Record<string, unknown>;
      const videoItems: VideoItem[] =
        (videosBody.items as VideoItem[]) ?? [];
      for (const v of videoItems) {
        viewSum += parseInt(v.statistics?.viewCount ?? "0", 10) || 0;
        likeSum += parseInt(v.statistics?.likeCount ?? "0", 10) || 0;
      }
    }
  } catch {
    videosError = "fetch_error";
  }

  const result: CollectorResult = {
    source: "youtube",
    metrics: [
      {
        category: "S1",
        metricKey: "youtube_video_count",
        rawValue: videoCount,
      },
      { category: "S1", metricKey: "youtube_view_sum", rawValue: viewSum },
      { category: "S1", metricKey: "youtube_like_sum", rawValue: likeSum },
    ],
    ...(videosError ? { error: videosError } : {}),
  };

  await cacheSet(cacheKey, result, SOCIAL_CACHE_TTL_SECONDS);
  return result;
}
