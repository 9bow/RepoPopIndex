import type { CollectorResult, Period } from "@/lib/types";
import { fetchWithRetry } from "@/lib/retry";
import { waitForRateLimit } from "@/lib/rate-limiter";
import { periodToSinceDate } from "@/lib/types";

const SEARCH_URL = "https://api.github.com/search/issues";

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
  };
}

async function searchCount(q: string): Promise<number | null> {
  await waitForRateLimit("github-search");
  const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&per_page=1`;
  const res = await fetchWithRetry(url, { headers: authHeaders() });
  if (!res.ok) return null;
  const data = await res.json() as { total_count?: number };
  return data.total_count ?? null;
}

async function searchItems(q: string, sort: string, order: string, perPage: number): Promise<unknown[]> {
  await waitForRateLimit("github-search");
  const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&sort=${sort}&order=${order}&per_page=${perPage}`;
  const res = await fetchWithRetry(url, { headers: authHeaders() });
  if (!res.ok) return [];
  const data = await res.json() as { items?: unknown[] };
  return data.items ?? [];
}

function medianMergeDays(items: unknown[]): number | null {
  const durations: number[] = [];
  for (const item of items) {
    const pr = item as { created_at?: string; pull_request?: { merged_at?: string | null } };
    const mergedAt = pr.pull_request?.merged_at;
    if (!mergedAt || !pr.created_at) continue;
    const ms = new Date(mergedAt).getTime() - new Date(pr.created_at).getTime();
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

  try {
    const [issuesOpened, issuesClosed, prsOpened] = await Promise.all([
      searchCount(`${repoQ}+type:issue+created:>${since}`),
      searchCount(`${repoQ}+type:issue+closed:>${since}`),
      searchCount(`${repoQ}+type:pr+created:>${since}`),
    ]);

    const mergedQuery = `${repoQ}+type:pr+merged:>${since}`;

    const [mergedItems, prsMerged] = await Promise.all([
      searchItems(mergedQuery, "updated", "desc", 30),
      searchCount(mergedQuery),
    ]);

    const uniqueAuthors = new Set(
      mergedItems.map((i) => (i as { user?: { login?: string } }).user?.login).filter(Boolean)
    ).size;

    const medianMerge = medianMergeDays(mergedItems);

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
    return { source: "github-search", metrics: [], error: message };
  }
}
