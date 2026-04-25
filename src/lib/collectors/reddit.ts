import type { CollectorResult, Period, Platform } from "@/lib/types";
import { periodToSinceDate } from "@/lib/types";
import { fetchWithRetry } from "@/lib/retry";
import { cacheGet, cacheSet } from "@/lib/cache";
import { redis } from "@/lib/rate-limiter";
import {
  socialCacheKey,
  SOCIAL_CACHE_TTL_SECONDS,
  REDDIT_TOKEN_KEY,
  REDDIT_TOKEN_LOCK_KEY,
} from "@/lib/collectors/_shared/cache-key";
import {
  emptySocialResult,
  REDDIT_METRIC_KEYS,
} from "@/lib/collectors/_shared/types";

const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const REDDIT_SEARCH_URL = "https://oauth.reddit.com/search";

interface RedditToken {
  access_token: string;
  expires_at: number; // epoch ms
}

interface RedditPost {
  score: number;
  num_comments: number;
  created_utc: number;
  url?: string;
  selftext?: string;
}

interface RedditSearchResponse {
  data?: {
    children?: Array<{ data: RedditPost }>;
  };
}

let _warnedUnconfigured = false;

function emptyResult(reason: Parameters<typeof emptySocialResult>[1]): CollectorResult {
  return emptySocialResult("reddit", reason, REDDIT_METRIC_KEYS);
}

async function getToken(
  clientId: string,
  clientSecret: string,
  userAgent: string
): Promise<string | null> {
  const cached = await cacheGet<RedditToken>(REDDIT_TOKEN_KEY);
  if (cached && cached.expires_at > Date.now()) {
    return cached.access_token;
  }

  const lockAcquired = await redis.set(REDDIT_TOKEN_LOCK_KEY, "1", {
    nx: true,
    ex: 10,
  });

  if (lockAcquired) {
    try {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const res = await fetchWithRetry(REDDIT_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": userAgent,
        },
        body: "grant_type=client_credentials",
      });

      if (res.status === 401 || res.status === 429 || res.status >= 500) {
        return null;
      }

      if (!res.ok) {
        return null;
      }

      const body = (await res.json()) as { access_token: string; expires_in: number };
      const token: RedditToken = {
        access_token: body.access_token,
        expires_at: Date.now() + body.expires_in * 1000,
      };

      await cacheSet(REDDIT_TOKEN_KEY, token, body.expires_in - 300);
      return token.access_token;
    } finally {
      await redis.del(REDDIT_TOKEN_LOCK_KEY);
    }
  }

  // Poll for token written by lock holder
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const polled = await cacheGet<RedditToken>(REDDIT_TOKEN_KEY);
    if (polled && polled.expires_at > Date.now()) {
      return polled.access_token;
    }
  }

  return null;
}

export async function collectReddit(
  platform: Platform,
  owner: string,
  repo: string,
  period: Period
): Promise<CollectorResult> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent = process.env.REDDIT_USER_AGENT;

  if (!clientId || !clientSecret || !userAgent) {
    if (!_warnedUnconfigured) {
      console.warn("[reddit] collector unconfigured: missing REDDIT_CLIENT_ID/SECRET/USER_AGENT");
      _warnedUnconfigured = true;
    }
    return emptyResult("unconfigured");
  }

  const cacheKey = socialCacheKey("reddit", platform, owner, repo, period);
  const cached = await cacheGet<CollectorResult>(cacheKey);
  if (cached) return cached;

  const token = await getToken(clientId, clientSecret, userAgent);
  if (!token) {
    return emptyResult("auth_failed");
  }

  const repoQuery =
    platform === "github"
      ? `github.com/${owner}/${repo}`
      : `huggingface.co/${owner}/${repo}`;

  const params = new URLSearchParams({
    q: repoQuery,
    t: "year",
    limit: "100",
    sort: "top",
  });

  let body: RedditSearchResponse;
  try {
    const res = await fetchWithRetry(
      `${REDDIT_SEARCH_URL}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": userAgent,
        },
      }
    );

    if (!res.ok) {
      return emptyResult("fetch_error");
    }

    body = (await res.json()) as RedditSearchResponse;
  } catch {
    return emptyResult("fetch_error");
  }

  const since = periodToSinceDate(period);
  const sinceMs = since.getTime();
  const children = body.data?.children ?? [];

  let postCount = 0;
  let scoreSum = 0;
  let commentSum = 0;

  for (const child of children) {
    const post = child.data;
    if (post.created_utc * 1000 < sinceMs) continue;

    const urlMatch =
      post.url?.includes(repoQuery) ||
      post.selftext?.includes(repoQuery);
    if (!urlMatch) continue;

    postCount += 1;
    scoreSum += post.score ?? 0;
    commentSum += post.num_comments ?? 0;
  }

  const result: CollectorResult = {
    source: "reddit",
    metrics: [
      { category: "S1", metricKey: "reddit_post_count", rawValue: postCount },
      { category: "S1", metricKey: "reddit_score_sum", rawValue: scoreSum },
      { category: "S1", metricKey: "reddit_comment_sum", rawValue: commentSum },
    ],
  };

  await cacheSet(cacheKey, result, SOCIAL_CACHE_TTL_SECONDS);
  return result;
}
