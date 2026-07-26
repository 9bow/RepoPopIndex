import { fetchWithRetry } from "@/lib/retry";
import { waitForRateLimit } from "@/lib/rate-limiter";
import { getManagedRepository } from "./repository-store";
import {
  markStargazerCacheStale,
  saveStargazerProfiles,
} from "./stargazer-store";
import type { StargazerDistribution, StargazerProfile } from "./types";

const GRAPHQL_URL = "https://api.github.com/graphql";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const ACCESS_RESTRICTION_MESSAGE =
  "GitHub가 stargazer 명단을 제공하지 않았습니다. 이 저장소의 관리자·협업자 권한이 있는 GitHub 토큰이 필요할 수 있습니다.";

class StargazerListUnavailableError extends Error {
  constructor(readonly totalStars: number) {
    super(ACCESS_RESTRICTION_MESSAGE);
  }
}

interface StargazerConnection {
  totalCount: number;
  edges: Array<{
    starredAt: string;
    node: {
      id: string;
      databaseId?: number | null;
      login: string;
      avatarUrl: string;
      url: string;
      createdAt: string;
    };
  }>;
  pageInfo: {
    endCursor?: string | null;
    hasNextPage: boolean;
  };
}

const QUERY = `
  query($owner: String!, $repo: String!, $after: String) {
    repository(owner: $owner, name: $repo) {
      stargazers(
        first: ${PAGE_SIZE}
        after: $after
        orderBy: { field: STARRED_AT, direction: DESC }
      ) {
        totalCount
        edges {
          starredAt
          node {
            id
            databaseId
            login
            avatarUrl
            url
            createdAt
          }
        }
        pageInfo { endCursor hasNextPage }
      }
    }
  }
`;

function month(value: string): string {
  return value.slice(0, 7);
}

export function buildStargazerDistribution(
  profiles: StargazerProfile[],
  totalStars: number,
  partial: boolean
): StargazerDistribution {
  const buckets = [
    { label: "7일 미만", minDays: 0, maxDays: 6, count: 0 },
    { label: "7–29일", minDays: 7, maxDays: 29, count: 0 },
    { label: "30–89일", minDays: 30, maxDays: 89, count: 0 },
    { label: "90–364일", minDays: 90, maxDays: 364, count: 0 },
    { label: "1–2년", minDays: 365, maxDays: 729, count: 0 },
    { label: "2년 이상", minDays: 730, maxDays: null, count: 0 },
  ];
  const signupMonths = new Map<string, number>();
  const starMonths = new Map<string, number>();
  for (const profile of profiles) {
    const bucket = buckets.find(
      (item) =>
        profile.accountAgeDaysAtStar >= item.minDays &&
        (item.maxDays === null ||
          profile.accountAgeDaysAtStar <= item.maxDays)
    );
    if (bucket) bucket.count++;
    signupMonths.set(
      month(profile.accountCreatedAt),
      (signupMonths.get(month(profile.accountCreatedAt)) ?? 0) + 1
    );
    starMonths.set(
      month(profile.starredAt),
      (starMonths.get(month(profile.starredAt)) ?? 0) + 1
    );
  }
  const denominator = profiles.length || 1;
  const ratio = (days: number) =>
    profiles.filter((profile) => profile.accountAgeDaysAtStar < days).length /
    denominator;
  return {
    sampledAt: new Date().toISOString(),
    sampledCount: profiles.length,
    totalStars,
    status: partial ? "partial" : "complete",
    error: null,
    oldestStarredAt: profiles.at(-1)?.starredAt ?? null,
    newestStarredAt: profiles[0]?.starredAt ?? null,
    ageBuckets: buckets,
    signupMonths: [...signupMonths]
      .map(([monthValue, count]) => ({ month: monthValue, count }))
      .sort((left, right) => left.month.localeCompare(right.month)),
    starMonths: [...starMonths]
      .map(([monthValue, count]) => ({ month: monthValue, count }))
      .sort((left, right) => left.month.localeCompare(right.month)),
    youngAccountRatios: {
      under7Days: ratio(7),
      under30Days: ratio(30),
      under90Days: ratio(90),
    },
  };
}

export async function syncStargazerProfiles(
  repositoryId: string
): Promise<StargazerDistribution> {
  const repository = await getManagedRepository(repositoryId);
  if (!repository) throw new Error("Managed repository not found");
  const profiles: StargazerProfile[] = [];
  let cursor: string | null = null;
  let totalStars = 0;
  let hasNextPage = false;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      await waitForRateLimit("github-graphql");
      const response = await fetchWithRetry(GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
        },
        body: JSON.stringify({
          query: QUERY,
          variables: {
            owner: repository.owner,
            repo: repository.repo,
            after: cursor,
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`GitHub stargazers HTTP ${response.status}`);
      }
      const body = (await response.json()) as {
        data?: { repository?: { stargazers?: StargazerConnection } };
        errors?: Array<{ message?: string }>;
      };
      const connection = body.data?.repository?.stargazers;
      if (!connection || body.errors?.length) {
        throw new Error(
          body.errors?.map((error) => error.message).filter(Boolean).join("; ") ||
            "GitHub stargazer data unavailable"
        );
      }
      totalStars = connection.totalCount;
      if (page === 0 && totalStars > 0 && connection.edges.length === 0) {
        throw new StargazerListUnavailableError(totalStars);
      }
      for (const edge of connection.edges) {
        const starredAt = new Date(edge.starredAt).getTime();
        const createdAt = new Date(edge.node.createdAt).getTime();
        profiles.push({
          id: Buffer.from(edge.node.id, "utf8").toString("base64url"),
          nodeId: edge.node.id,
          databaseId: edge.node.databaseId ?? null,
          login: edge.node.login,
          avatarUrl: edge.node.avatarUrl ?? null,
          profileUrl: edge.node.url,
          accountCreatedAt: edge.node.createdAt,
          starredAt: edge.starredAt,
          accountAgeDaysAtStar: Math.max(
            0,
            Math.floor((starredAt - createdAt) / 86_400_000)
          ),
        });
      }
      hasNextPage = connection.pageInfo.hasNextPage;
      cursor = connection.pageInfo.endCursor ?? null;
      if (!hasNextPage || !cursor) break;
    }
    const result = buildStargazerDistribution(
      profiles,
      totalStars,
      hasNextPage
    );
    await saveStargazerProfiles(repositoryId, profiles, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const cached = await markStargazerCacheStale(repositoryId, message);
    if (cached) return cached;
    if (error instanceof StargazerListUnavailableError) {
      const unavailable: StargazerDistribution = {
        ...buildStargazerDistribution([], error.totalStars, true),
        status: "unavailable",
        error: message,
      };
      await saveStargazerProfiles(repositoryId, [], unavailable);
      return unavailable;
    }
    throw error;
  }
}
