import type { CollectorResult, Period, Platform } from "@/lib/types";
import { periodToSinceDate } from "@/lib/types";
import { fetchWithRetry } from "@/lib/retry";
import { cacheGet, cacheSet } from "@/lib/cache";
import { socialCacheKey, SOCIAL_CACHE_TTL_SECONDS } from "@/lib/collectors/_shared/cache-key";
import { emptySocialResult, STACKOVERFLOW_METRIC_KEYS } from "@/lib/collectors/_shared/types";

const SO_API = "https://api.stackexchange.com/2.3/search/advanced";

interface SoItem {
  is_answered: boolean;
  score: number;
  answer_count: number;
  link: string;
  body?: string;
}

interface SoResponse {
  items?: SoItem[];
  total?: number;
}

export async function collectStackOverflow(
  platform: Platform,
  owner: string,
  repo: string,
  period: Period
): Promise<CollectorResult> {
  const cacheKey = socialCacheKey("stackoverflow", platform, owner, repo, period);
  const cached = await cacheGet<CollectorResult>(cacheKey);
  if (cached) return cached;

  const since = periodToSinceDate(period);
  const fromdate = Math.floor(since.getTime() / 1000);

  const repoPath =
    platform === "github"
      ? `github.com/${owner}/${repo}`
      : `huggingface.co/${owner}/${repo}`;

  const key = process.env.STACKEXCHANGE_KEY;
  const keyParam = key ? `&key=${encodeURIComponent(key)}` : "";

  const url =
    `${SO_API}?order=desc&sort=activity` +
    `&q=${encodeURIComponent(`"${repoPath}"`)}` +
    `&site=stackoverflow` +
    `&fromdate=${fromdate}` +
    `&pagesize=100` +
    `&filter=default` +
    keyParam;

  let body: SoResponse;
  try {
    const res = await fetchWithRetry(url);
    if (res.status === 429) {
      return emptySocialResult("stackoverflow", "rate_limited", STACKOVERFLOW_METRIC_KEYS);
    }
    if (res.status >= 500) {
      return emptySocialResult("stackoverflow", "fetch_error", STACKOVERFLOW_METRIC_KEYS);
    }
    if (!res.ok) {
      return emptySocialResult("stackoverflow", "fetch_error", STACKOVERFLOW_METRIC_KEYS);
    }
    body = (await res.json()) as SoResponse;
  } catch {
    return emptySocialResult("stackoverflow", "fetch_error", STACKOVERFLOW_METRIC_KEYS);
  }

  const items = body.items ?? [];
  const questionCount = body.total ?? items.length;
  const answeredCount = items.filter((item) => item.is_answered).length;
  const answeredRatio =
    questionCount === 0
      ? 0
      : Math.round((answeredCount / questionCount) * 100) / 100;
  const scoreSum = items.reduce((sum, item) => sum + item.score, 0);

  const result: CollectorResult = {
    source: "stackoverflow",
    metrics: [
      { category: "S1", metricKey: "so_question_count", rawValue: questionCount },
      { category: "S1", metricKey: "so_answered_ratio", rawValue: answeredRatio },
      { category: "S1", metricKey: "so_score_sum", rawValue: scoreSum },
    ],
  };

  await cacheSet(cacheKey, result, SOCIAL_CACHE_TTL_SECONDS);
  return result;
}
