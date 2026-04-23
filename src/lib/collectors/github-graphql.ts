import type { CollectorResult, Period } from "@/lib/types";
import { fetchWithRetry } from "@/lib/retry";
import { waitForRateLimit } from "@/lib/rate-limiter";
import { periodToSinceDate } from "@/lib/types";

const GRAPHQL_URL = "https://api.github.com/graphql";

const QUERY = `
  query($owner: String!, $repo: String!, $since: GitTimestamp!) {
    repository(owner: $owner, name: $repo) {
      stargazerCount
      forkCount
      watchers { totalCount }
      createdAt
      pushedAt
      hasIssuesEnabled
      hasDiscussionsEnabled
      description
      licenseInfo { spdxId }
      primaryLanguage { name }
      defaultBranchRef {
        target {
          ... on Commit {
            history(since: $since) { totalCount }
          }
        }
      }
      issues(states: OPEN) { totalCount }
      pullRequests(states: OPEN) { totalCount }
      discussions { totalCount }
    }
  }
`;

const QUERY_NO_DISCUSSIONS = `
  query($owner: String!, $repo: String!, $since: GitTimestamp!) {
    repository(owner: $owner, name: $repo) {
      stargazerCount
      forkCount
      watchers { totalCount }
      createdAt
      pushedAt
      hasIssuesEnabled
      hasDiscussionsEnabled
      description
      licenseInfo { spdxId }
      primaryLanguage { name }
      defaultBranchRef {
        target {
          ... on Commit {
            history(since: $since) { totalCount }
          }
        }
      }
      issues(states: OPEN) { totalCount }
      pullRequests(states: OPEN) { totalCount }
    }
  }
`;

export async function collectGitHubGraphQL(
  owner: string,
  repo: string,
  period: Period
): Promise<CollectorResult> {
  const token = process.env.GITHUB_TOKEN;
  const since = periodToSinceDate(period).toISOString();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `bearer ${token}`,
  };

  await waitForRateLimit("github-graphql");

  type GQLResponse = { data?: { repository?: Record<string, unknown> }; errors?: unknown[] };

  let data: GQLResponse | null = null;
  let discussionsEnabled = true;

  try {
    const res = await fetchWithRetry(GRAPHQL_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: QUERY, variables: { owner, repo, since } }),
    });

    data = await res.json() as GQLResponse;

    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      discussionsEnabled = false;
    }
  } catch {
    discussionsEnabled = false;
  }

  if (!discussionsEnabled || !data?.data?.repository) {
    await waitForRateLimit("github-graphql");
    try {
      const res = await fetchWithRetry(GRAPHQL_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: QUERY_NO_DISCUSSIONS, variables: { owner, repo, since } }),
      });
      data = await res.json() as GQLResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { source: "github-graphql", metrics: [], error: message };
    }
  }

  const r = data?.data?.repository as Record<string, unknown> | undefined;
  if (!r) {
    return { source: "github-graphql", metrics: [], error: "No repository data returned" };
  }

  const defaultBranchRef = r.defaultBranchRef as { target?: { history?: { totalCount?: number } } } | null;
  const commitCount = defaultBranchRef?.target?.history?.totalCount ?? 0;

  const watchers = (r.watchers as { totalCount?: number } | null)?.totalCount ?? null;
  const issues = (r.issues as { totalCount?: number } | null)?.totalCount ?? null;
  const pullRequests = (r.pullRequests as { totalCount?: number } | null)?.totalCount ?? null;
  const discussions = discussionsEnabled
    ? ((r.discussions as { totalCount?: number } | null)?.totalCount ?? null)
    : null;
  const licenseInfo = (r.licenseInfo as { spdxId?: string } | null)?.spdxId ?? null;

  return {
    source: "github-graphql",
    metrics: [
      { category: "G1", metricKey: "stars", rawValue: typeof r.stargazerCount === "number" ? r.stargazerCount : null },
      { category: "G1", metricKey: "forks", rawValue: typeof r.forkCount === "number" ? r.forkCount : null },
      { category: "G1", metricKey: "watchers", rawValue: watchers },
      { category: "G1", metricKey: "created_at", rawValue: null, rawJson: r.createdAt },
      { category: "G1", metricKey: "pushed_at", rawValue: null, rawJson: r.pushedAt },
      { category: "G1", metricKey: "open_issues", rawValue: issues },
      { category: "G1", metricKey: "open_prs", rawValue: pullRequests },
      { category: "G1", metricKey: "has_issues_enabled", rawValue: r.hasIssuesEnabled ? 1 : 0 },
      { category: "G1", metricKey: "description", rawValue: null, rawJson: r.description },
      { category: "G1", metricKey: "primary_language", rawValue: null, rawJson: (r.primaryLanguage as { name?: string } | null)?.name ?? null },
      { category: "G2", metricKey: "G2.5", rawValue: commitCount },
      { category: "G9", metricKey: "discussions_count", rawValue: discussions },
      { category: "G9", metricKey: "has_discussions_enabled", rawValue: r.hasDiscussionsEnabled ? 1 : 0 },
      { category: "G9", metricKey: "license_spdx", rawValue: null, rawJson: licenseInfo },
    ],
  };
}
