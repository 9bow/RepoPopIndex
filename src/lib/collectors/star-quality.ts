import type { CollectorResult } from "@/lib/types";
import { fetchWithRetry } from "@/lib/retry";
import { waitForRateLimit } from "@/lib/rate-limiter";

const GRAPHQL_URL = "https://api.github.com/graphql";

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
  };
}

interface StargazerNode {
  starredAt: string;
  node: {
    login: string;
    createdAt: string;
    followers: { totalCount: number };
    repositories: { totalCount: number };
  };
}

const TOTAL_STARS_QUERY = `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      stargazerCount
    }
  }
`;

/**
 * Recent stargazers query. Intentionally lightweight: we drop
 * `contributionsCollection.contributionCalendar` because GitHub charges high
 * GraphQL complexity for that field, and pulling it for 100 users routinely
 * exceeded the 15s collector budget on busy repos. follower/repo counts +
 * account age give a workable bot heuristic without the overhead.
 */
const STARGAZERS_QUERY = `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      stargazers(first: 100, orderBy: { field: STARRED_AT, direction: DESC }) {
        edges {
          starredAt
          node {
            login
            createdAt
            followers { totalCount }
            repositories { totalCount }
          }
        }
      }
    }
  }
`;

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  await waitForRateLimit("github-graphql");
  const res = await fetchWithRetry(GRAPHQL_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { data?: T; errors?: unknown[] };
  if (data.errors?.length) return null;
  return data.data ?? null;
}

function computeUqs(node: StargazerNode["node"], now: number): number {
  const ageDays = (now - new Date(node.createdAt).getTime()) / (1000 * 60 * 60 * 24);

  // Bot heuristic: brand-new account with no followers and no repos.
  if (
    ageDays < 7 ||
    (node.followers.totalCount === 0 && node.repositories.totalCount === 0)
  ) {
    return 0;
  }

  const A = Math.min(1, ageDays / 730);
  const F = Math.min(1, Math.log(1 + node.followers.totalCount) / Math.log(1 + 100));
  const R = Math.min(1, Math.log(1 + node.repositories.totalCount) / Math.log(1 + 30));

  return 0.4 * A + 0.3 * F + 0.3 * R;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function detectBurst(starredAts: string[]): boolean {
  if (starredAts.length === 0) return false;
  const counts: Record<string, number> = {};
  for (const dt of starredAts) {
    const day = dt.slice(0, 10);
    counts[day] = (counts[day] ?? 0) + 1;
  }
  const days = Object.values(counts);
  const dailyAvg = days.reduce((s, v) => s + v, 0) / days.length;
  return days.some((d) => d > dailyAvg * 5);
}

export async function analyzeStarQuality(
  owner: string,
  repo: string
): Promise<CollectorResult> {
  try {
    const totalData = await graphql<{ repository: { stargazerCount: number } }>(
      TOTAL_STARS_QUERY,
      { owner, repo }
    );

    const totalStars = totalData?.repository?.stargazerCount ?? 0;

    if (totalStars === 0) {
      return {
        source: "star-quality",
        metrics: [
          { category: "G8", metricKey: "G8.1", rawValue: 0 },
          { category: "G8", metricKey: "G8.2", rawValue: 0 },
        ],
      };
    }

    const recentData = await graphql<{
      repository: {
        stargazers: { edges: StargazerNode[] };
      };
    }>(STARGAZERS_QUERY, { owner, repo });

    const recentEdges: StargazerNode[] = recentData?.repository?.stargazers?.edges ?? [];

    if (recentEdges.length === 0) {
      // GraphQL returned nothing usable — surface as missing, not zero.
      return {
        source: "star-quality",
        metrics: [
          { category: "G8", metricKey: "G8.1", rawValue: null },
          { category: "G8", metricKey: "G8.2", rawValue: null },
        ],
        error: "no stargazer data returned",
      };
    }

    const now = Date.now();
    const uqs = recentEdges.map((e) => computeUqs(e.node, now));
    const avgUqs = average(uqs);
    const qualityStarScore = totalStars * avgUqs;

    // Star arrival rate: stars/day across the recent sample window.
    let g82: number | null = null;
    if (recentEdges.length >= 2) {
      const oldest = new Date(recentEdges[recentEdges.length - 1].starredAt).getTime();
      const newest = new Date(recentEdges[0].starredAt).getTime();
      const rangeDays = (newest - oldest) / (1000 * 60 * 60 * 24);
      g82 = rangeDays > 0 ? recentEdges.length / rangeDays : null;
    }

    const starredAts = recentEdges.map((e) => e.starredAt);
    const burstDetected = detectBurst(starredAts);

    return {
      source: "star-quality",
      metrics: [
        {
          category: "G8",
          metricKey: "G8.1",
          rawValue: qualityStarScore,
          rawJson: {
            avgUqs,
            avgUqsRecent: avgUqs,
            avgUqsHistorical: avgUqs,
            burstDetected,
            sampledCount: recentEdges.length,
          },
        },
        { category: "G8", metricKey: "G8.2", rawValue: g82 },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      source: "star-quality",
      metrics: [
        { category: "G8", metricKey: "G8.1", rawValue: null },
        { category: "G8", metricKey: "G8.2", rawValue: null },
      ],
      error: message,
    };
  }
}
