import { aggregateContributorInsights } from "@/lib/contributor-insights";
import type { ContributorActivityEvent } from "@/lib/contributor-insights";
import type { CollectorResult, GitHubContributorIdentity } from "@/lib/types";
import { fetchWithRetry } from "@/lib/retry";
import { waitForRateLimit } from "@/lib/rate-limiter";

const GRAPHQL_URL = "https://api.github.com/graphql";
const PAGE_SIZE = 100;
const MAX_PAGES_PER_SOURCE = 5;
const WINDOW_MONTHS = 12;
const OBSERVATION_MONTHS = 24;

interface PageInfo {
  endCursor?: string | null;
  hasNextPage?: boolean;
}

interface SearchNode {
  __typename?: "Issue" | "PullRequest";
  createdAt?: string;
  authorAssociation?: string;
  author?: {
    login?: string;
    __typename?: string;
    id?: string;
    databaseId?: number | null;
    avatarUrl?: string;
    url?: string;
  } | null;
}

interface CommitNode {
  committedDate?: string;
  author?: {
    user?: {
      login?: string;
      id?: string;
      databaseId?: number | null;
      avatarUrl?: string;
      url?: string;
    } | null;
  } | null;
}

interface SearchActivityData {
  search: {
    nodes?: SearchNode[];
    pageInfo?: PageInfo;
  };
}

interface CommitActivityData {
  repository?: {
    defaultBranchRef?: {
      target?: {
        history?: {
          nodes?: CommitNode[];
          pageInfo?: PageInfo;
        };
      } | null;
    } | null;
  } | null;
}

const SEARCH_ACTIVITY_QUERY = `
  query($query: String!, $after: String) {
    search(query: $query, type: ISSUE, first: ${PAGE_SIZE}, after: $after) {
      nodes {
        __typename
        ... on Issue {
          createdAt
          authorAssociation
          author {
            login
            __typename
            ... on User { id databaseId avatarUrl url }
          }
        }
        ... on PullRequest {
          createdAt
          authorAssociation
          author {
            login
            __typename
            ... on User { id databaseId avatarUrl url }
          }
        }
      }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

const COMMIT_ACTIVITY_QUERY = `
  query($owner: String!, $repo: String!, $since: GitTimestamp!, $after: String) {
    repository(owner: $owner, name: $repo) {
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: ${PAGE_SIZE}, after: $after, since: $since) {
              nodes {
                committedDate
                author {
                  user { login id databaseId avatarUrl url }
                }
              }
              pageInfo { endCursor hasNextPage }
            }
          }
        }
      }
    }
  }
`;

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
  };
}

async function graphql<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  await waitForRateLimit("github-graphql");
  const response = await fetchWithRetry(GRAPHQL_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };
  if (!body.data || body.errors?.length) {
    throw new Error(
      body.errors?.map((error) => error.message ?? "GraphQL error").join("; ") ??
        "GitHub GraphQL returned no data"
    );
  }
  return body.data;
}

function observationStart(now: Date): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - (OBSERVATION_MONTHS - 1),
      1
    )
  );
}

async function fetchSearchActivity(
  owner: string,
  repo: string,
  kind: "issue" | "pull_request",
  since: Date
): Promise<{ events: ContributorActivityEvent[]; truncated: boolean }> {
  const qualifier = kind === "issue" ? "type:issue" : "type:pr";
  const searchQuery =
    `repo:${owner}/${repo} ${qualifier} ` +
    `created:>=${since.toISOString().slice(0, 10)} sort:created-asc`;
  const events: ContributorActivityEvent[] = [];
  let cursor: string | null = null;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES_PER_SOURCE; page++) {
    const data: SearchActivityData = await graphql<SearchActivityData>(
      SEARCH_ACTIVITY_QUERY,
      { query: searchQuery, after: cursor }
    );

    for (const node of data.search.nodes ?? []) {
      const login = node.author?.login;
      if (!login || !node.createdAt) continue;
      events.push({
        actor: login,
        actorId: node.author?.id ?? null,
        actorDatabaseId: node.author?.databaseId ?? null,
        actorAvatarUrl: node.author?.avatarUrl ?? null,
        actorProfileUrl: node.author?.url ?? null,
        occurredAt: node.createdAt,
        kind,
        association: node.authorAssociation ?? null,
      });
    }

    const pageInfo = data.search.pageInfo;
    if (!pageInfo?.hasNextPage) {
      return { events, truncated: false };
    }
    cursor = pageInfo.endCursor ?? null;
    if (!cursor) {
      return { events, truncated: true };
    }
    truncated = page === MAX_PAGES_PER_SOURCE - 1;
  }

  return { events, truncated };
}

async function fetchCommitActivity(
  owner: string,
  repo: string,
  since: Date
): Promise<{ events: ContributorActivityEvent[]; truncated: boolean }> {
  const events: ContributorActivityEvent[] = [];
  let cursor: string | null = null;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES_PER_SOURCE; page++) {
    const data: CommitActivityData = await graphql<CommitActivityData>(
      COMMIT_ACTIVITY_QUERY,
      {
      owner,
      repo,
      since: since.toISOString(),
      after: cursor,
      }
    );

    const history = data.repository?.defaultBranchRef?.target?.history;
    if (!history) return { events, truncated: false };

    for (const node of history.nodes ?? []) {
      const login = node.author?.user?.login;
      if (!login || !node.committedDate) continue;
      events.push({
        actor: login,
        actorId: node.author?.user?.id ?? null,
        actorDatabaseId: node.author?.user?.databaseId ?? null,
        actorAvatarUrl: node.author?.user?.avatarUrl ?? null,
        actorProfileUrl: node.author?.user?.url ?? null,
        occurredAt: node.committedDate,
        kind: "commit",
        association: null,
      });
    }

    const pageInfo = history.pageInfo;
    if (!pageInfo?.hasNextPage) {
      return { events, truncated: false };
    }
    cursor = pageInfo.endCursor ?? null;
    if (!cursor) {
      return { events, truncated: true };
    }
    truncated = page === MAX_PAGES_PER_SOURCE - 1;
  }

  return { events, truncated };
}

export async function collectGitHubContributorInsights(
  owner: string,
  repo: string
): Promise<CollectorResult> {
  const now = new Date();
  const since = observationStart(now);

  try {
    const [commits, pullRequests, issues] = await Promise.all([
      fetchCommitActivity(owner, repo, since),
      fetchSearchActivity(owner, repo, "pull_request", since),
      fetchSearchActivity(owner, repo, "issue", since),
    ]);

    const truncatedSources = [
      ...(commits.truncated ? ["commits"] : []),
      ...(pullRequests.truncated ? ["pull_requests"] : []),
      ...(issues.truncated ? ["issues"] : []),
    ];
    const insights = aggregateContributorInsights(
      [...commits.events, ...pullRequests.events, ...issues.events],
      {
        now,
        windowMonths: WINDOW_MONTHS,
        observationMonths: OBSERVATION_MONTHS,
        truncatedSources,
      }
    );
    const contributorsByKey = new Map<string, GitHubContributorIdentity>();
    for (const event of [
      ...commits.events,
      ...pullRequests.events,
      ...issues.events,
    ]) {
      const key = event.actorId ?? event.actor.toLowerCase();
      const existing = contributorsByKey.get(key);
      const source =
        event.kind === "commit"
          ? "commits"
          : event.kind === "issue"
            ? "issues"
            : "pull_requests";
      if (!existing || existing.occurredAt < event.occurredAt) {
        contributorsByKey.set(key, {
          nodeId: event.actorId ?? null,
          databaseId: event.actorDatabaseId ?? null,
          login: event.actor,
          avatarUrl: event.actorAvatarUrl ?? null,
          profileUrl:
            event.actorProfileUrl ?? `https://github.com/${event.actor}`,
          source,
          occurredAt: event.occurredAt,
        });
      }
    }

    return {
      source: "github-contributors",
      contributors: [...contributorsByKey.values()],
      metrics: [
        {
          category: "G10",
          metricKey: "contributor_insights",
          rawValue: insights.activeContributors,
          rawJson: insights,
        },
      ],
    };
  } catch (error) {
    return {
      source: "github-contributors",
      metrics: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
