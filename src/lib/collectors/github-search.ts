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
  recentIssuesTFR?: {
    edges?: Array<{
      node?: {
        __typename?: string;
        createdAt?: string;
        timelineItems?: {
          nodes?: Array<{
            createdAt?: string;
          }>;
        };
      };
    }>;
  };
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
  query($issuesOpenedQ: String!, $issuesClosedQ: String!, $prsOpenedQ: String!, $prsMergedQ: String!, $recentIssuesTFRQ: String!) {
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
    recentIssuesTFR: search(query: $recentIssuesTFRQ, type: ISSUE, first: 10) {
      edges {
        node {
          ... on Issue {
            createdAt
            timelineItems(first: 1, itemTypes: [ISSUE_COMMENT]) {
              nodes {
                ... on IssueComment {
                  createdAt
                }
              }
            }
          }
        }
      }
    }
  }
`;

function medianDays(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function medianMergeDays(edges: NonNullable<SearchResult["edges"]>): number | null {
  const days: number[] = [];
  for (const e of edges) {
    const n = e.node;
    if (!n?.mergedAt || !n.createdAt) continue;
    days.push((new Date(n.mergedAt).getTime() - new Date(n.createdAt).getTime()) / 86_400_000);
  }
  return medianDays(days);
}

function medianFirstResponseDays(
  edges: NonNullable<NonNullable<GraphQLSearchData["recentIssuesTFR"]>["edges"]>
): number | null {
  const days: number[] = [];
  for (const e of edges) {
    const n = e.node;
    if (!n?.createdAt) continue;
    const firstComment = n.timelineItems?.nodes?.[0];
    if (!firstComment?.createdAt) continue;
    const ms = new Date(firstComment.createdAt).getTime() - new Date(n.createdAt).getTime();
    if (ms >= 0) days.push(ms / 86_400_000);
  }
  return medianDays(days);
}

interface SearchAttemptResult {
  data: GraphQLSearchData | null;
  partial: boolean;
  error: string | null;
}

async function attemptSearch(
  variables: Record<string, string>
): Promise<SearchAttemptResult> {
  await waitForRateLimit("github-search");
  const res = await fetchWithRetry(GRAPHQL_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ query: COMMUNITY_QUERY, variables }),
  });

  if (!res.ok) {
    return { data: null, partial: false, error: `HTTP ${res.status}` };
  }

  const body = (await res.json()) as { data?: GraphQLSearchData; errors?: unknown[] };
  const data = body?.data ?? null;
  const hasErrors = Array.isArray(body?.errors) && body.errors.length > 0;

  if (!data) {
    return { data: null, partial: false, error: hasErrors ? "GraphQL errors" : "Empty response" };
  }

  // Partial = HTTP 200 + data, but at least one alias is missing or has null
  // issueCount (GraphQL "errors" array fills in for the broken alias). This is
  // exactly the failure mode that produced "Community 데이터 부족" in prod —
  // 3/4 aliases came back null while one (prsMerged) returned an empty edges
  // list, leaving the collector with mostly N/A and a fake 0 for G4.4.
  const aliases: Array<keyof GraphQLSearchData> = [
    "issuesOpened",
    "issuesClosed",
    "prsOpened",
    "prsMerged",
  ];
  const missing = aliases.filter((a) => {
    const r = data[a] as SearchResult | undefined;
    return !r || typeof r.issueCount !== "number";
  });

  return {
    data,
    partial: missing.length > 0,
    error: missing.length > 0 ? `Partial (${missing.join(",")} missing)` : null,
  };
}

const MAX_SEARCH_ATTEMPTS = 3;
const SEARCH_BACKOFF_MS = [1000, 3000]; // between attempts 1→2 and 2→3

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
    recentIssuesTFRQ: `${repoQ} type:issue created:>${since} sort:created-desc`,
  };

  let attemptResult: SearchAttemptResult = {
    data: null,
    partial: false,
    error: "not attempted",
  };

  for (let attempt = 0; attempt < MAX_SEARCH_ATTEMPTS; attempt++) {
    try {
      attemptResult = await attemptSearch(variables);
    } catch (err) {
      attemptResult = {
        data: null,
        partial: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }

    // Success: full data, no partial errors
    if (attemptResult.data && !attemptResult.partial) break;

    // No more retries
    if (attempt === MAX_SEARCH_ATTEMPTS - 1) break;

    const delay = SEARCH_BACKOFF_MS[attempt] ?? 3000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  const data = attemptResult.data;

  if (!data) {
    return {
      source: "github-search",
      metrics: nullMetrics(),
      error: attemptResult.error ?? "Unknown error",
    };
  }

  const issuesOpened = data.issuesOpened?.issueCount ?? null;
  const issuesClosed = data.issuesClosed?.issueCount ?? null;
  const prsOpened = data.prsOpened?.issueCount ?? null;
  const prsMerged = data.prsMerged?.issueCount ?? null;

  // Trust uniqueAuthors / medianMerge only when the prsMerged alias itself
  // succeeded. An empty edges list paired with a null issueCount is the
  // symptom of a partial GraphQL failure, not "0 merged PRs", and we must
  // not report G4.4 = 0 in that case (it would skew the Community score).
  const mergedEdges = prsMerged !== null ? data.prsMerged?.edges ?? null : null;

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

  const tfrEdges = data.recentIssuesTFR?.edges ?? null;
  const medianFirstResponse = tfrEdges !== null ? medianFirstResponseDays(tfrEdges) : null;

  return {
    source: "github-search",
    metrics: [
      { category: "G3", metricKey: "G3.1", rawValue: issuesOpened },
      { category: "G3", metricKey: "G3.2", rawValue: issuesClosed },
      { category: "G3", metricKey: "G3.3", rawValue: issueCloseRatio },
      { category: "G3", metricKey: "G3.4", rawValue: medianFirstResponse },
      { category: "G4", metricKey: "G4.1", rawValue: prsOpened },
      { category: "G4", metricKey: "G4.2", rawValue: prsMerged },
      { category: "G4", metricKey: "G4.3", rawValue: prMergeRatio },
      { category: "G4", metricKey: "G4.4", rawValue: uniqueAuthors },
      { category: "G4", metricKey: "G4.5", rawValue: medianMerge },
    ],
    error: attemptResult.partial ? attemptResult.error ?? undefined : undefined,
  };
}

function nullMetrics() {
  return [
    { category: "G3", metricKey: "G3.1", rawValue: null },
    { category: "G3", metricKey: "G3.2", rawValue: null },
    { category: "G3", metricKey: "G3.3", rawValue: null },
    { category: "G3", metricKey: "G3.4", rawValue: null },
    { category: "G4", metricKey: "G4.1", rawValue: null },
    { category: "G4", metricKey: "G4.2", rawValue: null },
    { category: "G4", metricKey: "G4.3", rawValue: null },
    { category: "G4", metricKey: "G4.4", rawValue: null },
    { category: "G4", metricKey: "G4.5", rawValue: null },
  ];
}
