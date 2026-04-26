import type { CollectorResult, Period, Platform } from "@/lib/types";
import { fetchWithRetry } from "@/lib/retry";
import { waitForRateLimit } from "@/lib/rate-limiter";
import { periodToSinceDate } from "@/lib/types";

const HN_API = "https://hn.algolia.com/api/v1/search";

interface HnHit {
  title?: string;
  url?: string;
  points?: number;
  num_comments?: number;
}

interface HnResponse {
  nbHits?: number;
  hits?: HnHit[];
}

function emptyResult(error: string): CollectorResult {
  return {
    source: "hackernews",
    metrics: [
      { category: "S1", metricKey: "story_count", rawValue: 0 },
      { category: "S1", metricKey: "total_points", rawValue: 0 },
      { category: "S1", metricKey: "total_comments", rawValue: 0 },
      { category: "S1", metricKey: "engagement", rawValue: 0 },
      { category: "S1", metricKey: "top_story", rawValue: 0, rawJson: null },
    ],
    error,
  };
}

export async function collectHackerNews(
  platform: Platform,
  owner: string,
  repo: string,
  period: Period
): Promise<CollectorResult> {
  const since = periodToSinceDate(period);
  const sinceUnix = Math.floor(since.getTime() / 1000);

  const query =
    platform === "github"
      ? `github.com/${owner}/${repo}`
      : `huggingface.co/${owner}/${repo}`;

  const url = `${HN_API}?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>${sinceUnix}&hitsPerPage=100`;

  await waitForRateLimit("hackernews");

  let body: HnResponse;
  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      return emptyResult(`HN API error: ${res.status}`);
    }
    body = (await res.json()) as HnResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return emptyResult(message);
  }

  const hits = body.hits ?? [];
  const storyCount = body.nbHits ?? hits.length;

  let totalPoints = 0;
  let totalComments = 0;
  let engagement = 0;
  let topStory: { title: string; url: string; points: number } | null = null;

  for (const hit of hits) {
    const points = hit.points ?? 0;
    const comments = hit.num_comments ?? 0;
    totalPoints += points;
    totalComments += comments;
    engagement += points * 1.0 + comments * 1.5;

    if (!topStory || points > topStory.points) {
      topStory = {
        title: hit.title ?? "",
        url: hit.url ?? "",
        points,
      };
    }
  }

  return {
    source: "hackernews",
    metrics: [
      { category: "S1", metricKey: "story_count", rawValue: storyCount },
      { category: "S1", metricKey: "total_points", rawValue: totalPoints },
      { category: "S1", metricKey: "total_comments", rawValue: totalComments },
      { category: "S1", metricKey: "engagement", rawValue: engagement },
      {
        category: "S1",
        metricKey: "top_story",
        rawValue: topStory?.points ?? 0,
        rawJson: topStory,
      },
    ],
  };
}
