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
    contributionsCollection: {
      contributionCalendar: { totalContributions: number };
    };
  };
}

const TOTAL_STARS_QUERY = `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      stargazerCount
    }
  }
`;

const STARGAZERS_QUERY = `
  query($owner: String!, $repo: String!, $after: String) {
    repository(owner: $owner, name: $repo) {
      stargazers(first: 100, orderBy: { field: STARRED_AT, direction: DESC }, after: $after) {
        edges {
          starredAt
          node {
            login
            createdAt
            followers { totalCount }
            repositories { totalCount }
            contributionsCollection {
              contributionCalendar { totalContributions }
            }
          }
        }
        pageInfo { endCursor hasNextPage }
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

  // Bot flag
  if (
    ageDays < 7 ||
    (node.followers.totalCount === 0 &&
      node.repositories.totalCount === 0 &&
      node.contributionsCollection.contributionCalendar.totalContributions === 0)
  ) {
    return 0;
  }

  const A = Math.min(1, ageDays / 730);
  const F = Math.min(1, Math.log(1 + node.followers.totalCount) / Math.log(1 + 100));
  const R = Math.min(1, Math.log(1 + node.repositories.totalCount) / Math.log(1 + 30));
  const C = Math.min(
    1,
    Math.log(1 + node.contributionsCollection.contributionCalendar.totalContributions) /
      Math.log(1 + 500)
  );

  return 0.25 * A + 0.25 * F + 0.25 * R + 0.25 * C;
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
    // Step 1: get total star count
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
          { category: "G8", metricKey: "G8.3", rawValue: 0 },
        ],
      };
    }

    // Step 2: fetch 100 most recent stargazers
    const recentData = await graphql<{
      repository: {
        stargazers: {
          edges: StargazerNode[];
          pageInfo: { endCursor: string; hasNextPage: boolean };
        };
      };
    }>(STARGAZERS_QUERY, { owner, repo, after: null });

    const recentEdges: StargazerNode[] = recentData?.repository?.stargazers?.edges ?? [];

    // Step 3: historical sample if total > 200
    let historicalEdges: StargazerNode[] = [];
    if (totalStars > 200) {
      const offset = Math.floor(Math.random() * (totalStars - 100));
      // Build a cursor by paginating to the offset using pageInfo
      // GitHub GraphQL doesn't support offset-based cursors directly;
      // use the endCursor from the recent batch shifted to approximate position.
      // We fetch a second batch from a rough midpoint by computing pages.
      // Since we can't do true random cursor without pagination, we use
      // the endCursor pattern by requesting from the ~offset page.
      // Simplest viable approach: fetch page at floor(offset/100) * 100 index.
      const pageIndex = Math.floor(offset / 100);
      let cursor: string | null = null;

      type PageData = {
        repository: {
          stargazers: { pageInfo: { endCursor: string; hasNextPage: boolean } };
        };
      };
      const PAGE_QUERY = `query($owner: String!, $repo: String!, $after: String) {
        repository(owner: $owner, name: $repo) {
          stargazers(first: 100, orderBy: { field: STARRED_AT, direction: DESC }, after: $after) {
            pageInfo { endCursor hasNextPage }
          }
        }
      }`;

      for (let i = 0; i < pageIndex; i++) {
        await waitForRateLimit("github-graphql");
        const pageData: PageData | null = await graphql<PageData>(PAGE_QUERY, { owner, repo, after: cursor });
        const pi: { endCursor: string; hasNextPage: boolean } | undefined =
          pageData?.repository?.stargazers?.pageInfo;
        if (!pi?.hasNextPage) break;
        cursor = pi.endCursor;
      }

      if (cursor !== null) {
        const histData = await graphql<{
          repository: { stargazers: { edges: StargazerNode[] } };
        }>(STARGAZERS_QUERY, { owner, repo, after: cursor });
        historicalEdges = histData?.repository?.stargazers?.edges ?? [];
      }
    }

    const now = Date.now();
    const recentUqs = recentEdges.map((e) => computeUqs(e.node, now));
    const historicalUqs = historicalEdges.map((e) => computeUqs(e.node, now));

    const avgUqsRecent = average(recentUqs);
    const avgUqsHistorical = historicalEdges.length > 0 ? average(historicalUqs) : avgUqsRecent;
    const avgUqs = (avgUqsRecent + avgUqsHistorical) / 2;

    const qualityStarScore = totalStars * avgUqs;

    // Star growth rate from recent sample date range
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
          rawJson: { avgUqsRecent, avgUqsHistorical, avgUqs, burstDetected },
        },
        { category: "G8", metricKey: "G8.2", rawValue: g82 },
        { category: "G8", metricKey: "G8.3", rawValue: burstDetected ? 1 : 0 },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { source: "star-quality", metrics: [], error: message };
  }
}
