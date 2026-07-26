import type {
  CollectorResult,
  FirstResponseSummary,
  Period,
} from "@/lib/types";
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
        author?: { login?: string } | null;
        comments?: {
          totalCount?: number;
          nodes?: Array<{
            createdAt?: string;
            authorAssociation?: string;
            author?: {
              login?: string;
              __typename?: string;
            } | null;
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
    recentIssuesTFR: search(query: $recentIssuesTFRQ, type: ISSUE, first: 30) {
      edges {
        node {
          ... on Issue {
            createdAt
            author { login }
            comments(first: 20) {
              totalCount
              nodes {
                createdAt
                authorAssociation
                author { login __typename }
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

const MAINTAINER_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

function isBotActor(actor: { login?: string; __typename?: string } | null | undefined): boolean {
  if (!actor?.login) return false;
  const login = actor.login.toLowerCase();
  return (
    actor.__typename === "Bot" ||
    login.endsWith("[bot]") ||
    login.endsWith("-bot")
  );
}

function medianHours(values: number[]): number | null {
  const median = medianDays(values.map((hours) => hours / 24));
  return median === null ? null : median * 24;
}

export function computeFirstResponseSummary(
  edges: NonNullable<NonNullable<GraphQLSearchData["recentIssuesTFR"]>["edges"]>
): FirstResponseSummary {
  const humanHours: number[] = [];
  const maintainerHours: number[] = [];
  let unansweredByHuman = 0;
  let unansweredByMaintainer = 0;
  let excludedSelfComments = 0;
  let excludedBotComments = 0;
  let commentsTruncated = false;

  for (const e of edges) {
    const n = e.node;
    if (!n?.createdAt) continue;
    const issueAuthor = n.author?.login?.toLowerCase();
    const comments = [...(n.comments?.nodes ?? [])]
      .filter((comment) => comment.createdAt)
      .sort(
        (left, right) =>
          new Date(left.createdAt!).getTime() -
          new Date(right.createdAt!).getTime()
      );
    if ((n.comments?.totalCount ?? 0) > comments.length) commentsTruncated = true;

    let firstHumanHours: number | null = null;
    let firstMaintainerHours: number | null = null;
    for (const comment of comments) {
      const commentAuthor = comment.author?.login?.toLowerCase();
      if (commentAuthor && issueAuthor && commentAuthor === issueAuthor) {
        excludedSelfComments++;
        continue;
      }
      if (isBotActor(comment.author)) {
        excludedBotComments++;
        continue;
      }

      const ms =
        new Date(comment.createdAt!).getTime() -
        new Date(n.createdAt).getTime();
      if (ms < 0) continue;
      const hours = ms / 3_600_000;
      if (firstHumanHours === null) firstHumanHours = hours;
      if (
        firstMaintainerHours === null &&
        MAINTAINER_ASSOCIATIONS.has(comment.authorAssociation ?? "")
      ) {
        firstMaintainerHours = hours;
      }
    }

    if (firstHumanHours === null) unansweredByHuman++;
    else humanHours.push(firstHumanHours);
    if (firstMaintainerHours === null) unansweredByMaintainer++;
    else maintainerHours.push(firstMaintainerHours);
  }

  return {
    sampledIssues: edges.filter((edge) => edge.node?.createdAt).length,
    humanResponses: humanHours.length,
    maintainerResponses: maintainerHours.length,
    unansweredByHuman,
    unansweredByMaintainer,
    medianHumanResponseHours: medianHours(humanHours),
    medianMaintainerResponseHours: medianHours(maintainerHours),
    excludedSelfComments,
    excludedBotComments,
    commentsTruncated,
  };
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
  const firstResponse =
    tfrEdges !== null ? computeFirstResponseSummary(tfrEdges) : null;
  const medianFirstResponse =
    firstResponse?.medianHumanResponseHours !== null &&
    firstResponse?.medianHumanResponseHours !== undefined
      ? firstResponse.medianHumanResponseHours / 24
      : null;

  return {
    source: "github-search",
    metrics: [
      { category: "G3", metricKey: "G3.1", rawValue: issuesOpened },
      { category: "G3", metricKey: "G3.2", rawValue: issuesClosed },
      { category: "G3", metricKey: "G3.3", rawValue: issueCloseRatio },
      {
        category: "G3",
        metricKey: "G3.4",
        rawValue: medianFirstResponse,
        rawJson: firstResponse,
      },
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
