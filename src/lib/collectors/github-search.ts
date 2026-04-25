import type { CollectorResult, Period } from "@/lib/types";
import { fetchWithRetry } from "@/lib/retry";
import { waitForRateLimit } from "@/lib/rate-limiter";
import { periodToSinceDate } from "@/lib/types";

const GRAPHQL_URL = "https://api.github.com/graphql";

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
  };
}

interface SearchResult {
  issueCount?: number;
  edges?: Array<{
    node?: {
      __typename?: string;
      author?: { login?: string } | null;
      createdAt?: string;
      mergedAt?: string | null;
    };
  }>;
}

interface GraphQLSearchData {
  issuesOpened?: SearchResult;
  issuesClosed?: SearchResult;
  prsOpened?: SearchResult;
  prsMerged?: SearchResult;
}

/**
 * Single aliased GraphQL request replaces 4 separate REST `/search/issues`
 * calls. The REST search endpoint returns 403 under GitHub's secondary
 * rate limit roughly every time several analyses run in parallel — those
 * 403s are not retried (different from primary 429), and they collapse
 * the entire Community category to N/A. Aliased GraphQL gives us a single
 * HTTP call where partial failures arrive as per-alias `errors`, and any
 * primary 429 is honoured by `fetchWithRetry`.
 */
const COMMUNITY_QUERY = `
  query($issuesOpenedQ: String!, $issuesClosedQ: String!, $prsOpenedQ: String!, $prsMergedQ: String!) {
    issuesOpened: search(query: $issuesOpenedQ, type: ISSUE) { issueCount }
    issuesClosed: search(query: $issuesClosedQ, type: ISSUE) { issueCount }
    prsOpened: search(query: $prsOpenedQ, type: ISSUE) { issueCount }
    prsMerged: search(query: $prsMergedQ, type: ISSUE, first: 30) {
      issueCount
      edges {
        node {
          __typename
          ... on PullRequest {
            author { login }
            createdAt
            mergedAt
          }
        }
      }
    }
  }
`;

function medianMergeDays(edges: NonNullable<SearchResult["edges"]>): number | null {
  const durations: number[] = [];
  for (const e of edges) {
    const n = e.node;
    if (!n?.mergedAt || !n.createdAt) continue;
    const ms = new Date(n.mergedAt).getTime() - new Date(n.createdAt).getTime();
    durations.push(ms / (1000 * 60 * 60 * 24));
  }
  if (durations.length === 0) return null;
  durations.sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  return durations.length % 2 === 0
    ? (durations[mid - 1] + durations[mid]) / 2
    : durations[mid];
}

export async function collectGitHubSearch(
  owner: string,
  repo: string,
  period: Period
): Promise<CollectorResult> {
  const since = periodToSinceDate(period).toISOString().slice(0, 10);
  const repoQ = `repo:${owner}/${repo}`;

  const variables = {
    issuesOpenedQ: `${repoQ} type:issue created:>${since}`,
    issuesClosedQ: `${repoQ} type:issue closed:>${since}`,
    prsOpenedQ: `${repoQ} type:pr created:>${since}`,
    prsMergedQ: `${repoQ} type:pr merged:>${since}`,
  };

  try {
    await waitForRateLimit("github-search");
    const res = await fetchWithRetry(GRAPHQL_URL, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ query: COMMUNITY_QUERY, variables }),
    });

    if (!res.ok) {
      return {
        source: "github-search",
        metrics: nullMetrics(),
        error: `HTTP ${res.status}`,
      };
    }

    const body = (await res.json()) as { data?: GraphQLSearchData; errors?: unknown[] };
    const data = body?.data;

    const issuesOpened = data?.issuesOpened?.issueCount ?? null;
    const issuesClosed = data?.issuesClosed?.issueCount ?? null;
    const prsOpened = data?.prsOpened?.issueCount ?? null;
    const prsMerged = data?.prsMerged?.issueCount ?? null;

    const mergedEdges = data?.prsMerged?.edges ?? null;

    let uniqueAuthors: number | null = null;
    let medianMerge: number | null = null;

    if (mergedEdges !== null) {
      const authorSet = new Set<string>();
      for (const e of mergedEdges) {
        const login = e.node?.author?.login;
        if (login) authorSet.add(login);
      }
      uniqueAuthors = authorSet.size;
      medianMerge = medianMergeDays(mergedEdges);
    }

    const issueCloseRatio =
      issuesOpened !== null && issuesOpened > 0 && issuesClosed !== null
        ? issuesClosed / issuesOpened
        : null;

    const prMergeRatio =
      prsOpened !== null && prsOpened > 0 && prsMerged !== null
        ? prsMerged / prsOpened
        : null;

    return {
      source: "github-search",
      metrics: [
        { category: "G3", metricKey: "G3.1", rawValue: issuesOpened },
        { category: "G3", metricKey: "G3.2", rawValue: issuesClosed },
        { category: "G3", metricKey: "G3.3", rawValue: issueCloseRatio },
        { category: "G4", metricKey: "G4.1", rawValue: prsOpened },
        { category: "G4", metricKey: "G4.2", rawValue: prsMerged },
        { category: "G4", metricKey: "G4.3", rawValue: prMergeRatio },
        { category: "G4", metricKey: "G4.4", rawValue: uniqueAuthors },
        { category: "G4", metricKey: "G4.5", rawValue: medianMerge },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      source: "github-search",
      metrics: nullMetrics(),
      error: message,
    };
  }
}

function nullMetrics() {
  return [
    { category: "G3", metricKey: "G3.1", rawValue: null },
    { category: "G3", metricKey: "G3.2", rawValue: null },
    { category: "G3", metricKey: "G3.3", rawValue: null },
    { category: "G4", metricKey: "G4.1", rawValue: null },
    { category: "G4", metricKey: "G4.2", rawValue: null },
    { category: "G4", metricKey: "G4.3", rawValue: null },
    { category: "G4", metricKey: "G4.4", rawValue: null },
    { category: "G4", metricKey: "G4.5", rawValue: null },
  ];
}
