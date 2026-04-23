import type { CollectorResult, Period } from "@/lib/types";
import { fetchWithRetry } from "@/lib/retry";
import { waitForRateLimit } from "@/lib/rate-limiter";
import { periodToSinceDate } from "@/lib/types";

const BASE_URL = "https://api.github.com";

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
  };
}

function parseLinkLastPage(linkHeader: string | null): number | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return match ? parseInt(match[1], 10) : null;
}

async function fetchParticipation(owner: string, repo: string): Promise<{ all: number[]; owner: number[] } | null> {
  await waitForRateLimit("github-rest");
  const res = await fetchWithRetry(
    `${BASE_URL}/repos/${owner}/${repo}/stats/participation`,
    { headers: authHeaders() }
  );
  if (!res.ok) return null;
  const data = await res.json() as { all?: number[]; owner?: number[] };
  if (!Array.isArray(data.all) || !Array.isArray(data.owner)) return null;
  return { all: data.all, owner: data.owner };
}

async function fetchCodeFrequency(owner: string, repo: string): Promise<number[][] | null> {
  await waitForRateLimit("github-rest");
  const res = await fetchWithRetry(
    `${BASE_URL}/repos/${owner}/${repo}/stats/code_frequency`,
    { headers: authHeaders() }
  );
  if (!res.ok) return null;
  const data = await res.json() as unknown;
  if (!Array.isArray(data)) return null;
  return data as number[][];
}

async function fetchCommunityProfile(owner: string, repo: string): Promise<Record<string, unknown> | null> {
  await waitForRateLimit("github-rest");
  const res = await fetchWithRetry(
    `${BASE_URL}/repos/${owner}/${repo}/community/profile`,
    { headers: authHeaders() }
  );
  if (!res.ok) return null;
  return res.json() as Promise<Record<string, unknown>>;
}

async function fetchReleases(owner: string, repo: string): Promise<unknown[]> {
  await waitForRateLimit("github-rest");
  const res = await fetchWithRetry(
    `${BASE_URL}/repos/${owner}/${repo}/releases?per_page=100`,
    { headers: authHeaders() }
  );
  if (!res.ok) return [];
  return res.json() as Promise<unknown[]>;
}

async function fetchContributorCount(owner: string, repo: string): Promise<number | null> {
  await waitForRateLimit("github-rest");
  const res = await fetchWithRetry(
    `${BASE_URL}/repos/${owner}/${repo}/contributors?per_page=1&anon=true`,
    { headers: authHeaders() }
  );
  if (!res.ok) return null;
  const lastPage = parseLinkLastPage(res.headers.get("Link"));
  if (lastPage !== null) return lastPage;
  const data = await res.json() as unknown[];
  return Array.isArray(data) ? data.length : null;
}

async function fetchTagCount(owner: string, repo: string): Promise<number | null> {
  await waitForRateLimit("github-rest");
  const res = await fetchWithRetry(
    `${BASE_URL}/repos/${owner}/${repo}/tags?per_page=1`,
    { headers: authHeaders() }
  );
  if (!res.ok) return null;
  const lastPage = parseLinkLastPage(res.headers.get("Link"));
  if (lastPage !== null) return lastPage;
  const data = await res.json() as unknown[];
  return Array.isArray(data) ? data.length : null;
}

export async function collectGitHubRest(
  owner: string,
  repo: string,
  period: Period
): Promise<CollectorResult> {
  const sinceDate = periodToSinceDate(period);

  try {
    const [participation, codeFrequency, communityProfile, releases, contributorCount, tagCount] =
      await Promise.all([
        fetchParticipation(owner, repo),
        fetchCodeFrequency(owner, repo),
        fetchCommunityProfile(owner, repo),
        fetchReleases(owner, repo),
        fetchContributorCount(owner, repo),
        fetchTagCount(owner, repo),
      ]);

    // G2.1, G2.2, G2.6 from participation stats
    let g21: number | null = null;
    let g22: number | null = null;
    let g26: number | null = null;

    if (participation) {
      const { all, owner: ownerCommits } = participation;
      g21 = all.reduce((s, v) => s + v, 0);
      const sumAll = g21;
      const sumOwner = ownerCommits.reduce((s, v) => s + v, 0);
      g22 = sumAll > 0 ? 1 - sumOwner / sumAll : null;

      const recent4 = all.slice(-4).reduce((s, v) => s + v, 0);
      const prior4 = all.slice(-8, -4).reduce((s, v) => s + v, 0);
      g26 = prior4 > 0 ? recent4 / prior4 : null;
    }

    // G2.3 from code_frequency
    let g23additions: number | null = null;
    let g23deletions: number | null = null;

    if (codeFrequency) {
      const sinceMs = sinceDate.getTime();
      let additions = 0;
      let deletions = 0;
      for (const [ts, add, del] of codeFrequency) {
        if (ts * 1000 >= sinceMs) {
          additions += add;
          deletions += Math.abs(del);
        }
      }
      g23additions = additions;
      g23deletions = deletions;
    }

    // G7.1-G7.4 from community profile
    let g71: number | null = null;
    let g72 = 0;
    let g73 = 0;
    let g74 = 0;

    if (communityProfile) {
      g71 = typeof communityProfile.health_percentage === "number"
        ? communityProfile.health_percentage
        : null;
      const files = communityProfile.files as Record<string, unknown> | null;
      if (files) {
        g72 = files.contributing !== null && files.contributing !== undefined ? 1 : 0;
        g73 = files.code_of_conduct !== null && files.code_of_conduct !== undefined ? 1 : 0;
        g74 = files.readme !== null && files.readme !== undefined ? 1 : 0;
      }
    }

    // G5.1-G5.3 from releases
    const sinceMs = sinceDate.getTime();
    type Release = { published_at?: string; assets?: { download_count?: number }[] };
    const periodReleases = (releases as Release[]).filter((r) => {
      if (!r.published_at) return false;
      return new Date(r.published_at).getTime() >= sinceMs;
    });

    const g51 = periodReleases.length;

    let g52: number | null = null;
    if (periodReleases.length >= 2) {
      const dates = periodReleases
        .map((r) => new Date(r.published_at!).getTime())
        .sort((a, b) => a - b);
      const gaps: number[] = [];
      for (let i = 1; i < dates.length; i++) {
        gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
      }
      g52 = gaps.reduce((s, v) => s + v, 0) / gaps.length;
    }

    const g53 = periodReleases.reduce((sum, r) => {
      const downloads = (r.assets ?? []).reduce((s, a) => s + (a.download_count ?? 0), 0);
      return sum + downloads;
    }, 0);

    return {
      source: "github-rest",
      metrics: [
        { category: "G2", metricKey: "G2.1", rawValue: g21 },
        { category: "G2", metricKey: "G2.2", rawValue: g22 },
        { category: "G2", metricKey: "G2.3_additions", rawValue: g23additions },
        { category: "G2", metricKey: "G2.3_deletions", rawValue: g23deletions },
        { category: "G2", metricKey: "G2.4", rawValue: contributorCount },
        { category: "G2", metricKey: "G2.6", rawValue: g26 },
        { category: "G5", metricKey: "G5.1", rawValue: g51 },
        { category: "G5", metricKey: "G5.2", rawValue: g52 },
        { category: "G5", metricKey: "G5.3", rawValue: g53 },
        { category: "G5", metricKey: "G5.4", rawValue: tagCount },
        { category: "G7", metricKey: "G7.1", rawValue: g71 },
        { category: "G7", metricKey: "G7.2", rawValue: g72 },
        { category: "G7", metricKey: "G7.3", rawValue: g73 },
        { category: "G7", metricKey: "G7.4", rawValue: g74 },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { source: "github-rest", metrics: [], error: message };
  }
}
