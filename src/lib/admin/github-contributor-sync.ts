import { fetchWithRetry } from "@/lib/retry";
import { waitForRateLimit } from "@/lib/rate-limiter";
import type { GitHubContributorIdentity } from "@/lib/types";
import {
  listManagedContributors,
  upsertManagedContributors,
} from "./contributor-store";
import {
  getManagedRepository,
  updateContributorSyncState,
} from "./repository-store";

const MAX_PAGES = 100;
const PAGE_SIZE = 100;

interface RestContributor {
  login?: string;
  id?: number;
  node_id?: string;
  avatar_url?: string;
  html_url?: string;
  contributions?: number;
  type?: string;
}

export async function syncGitHubContributors(
  repositoryId: string
): Promise<{ count: number; truncated: boolean }> {
  const repository = await getManagedRepository(repositoryId);
  if (!repository) throw new Error("Managed repository not found");
  await updateContributorSyncState(repositoryId, {
    contributorSyncStatus: "syncing",
  });

  try {
    let truncated = false;
    for (let page = 1; page <= MAX_PAGES; page++) {
      await waitForRateLimit("github-rest");
      const response = await fetchWithRetry(
        `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/contributors?per_page=${PAGE_SIZE}&page=${page}&anon=false`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            "X-GitHub-Api-Version": "2026-03-10",
          },
        }
      );
      if (!response.ok) {
        throw new Error(`GitHub contributors HTTP ${response.status}`);
      }
      const rows = (await response.json()) as RestContributor[];
      const identities: GitHubContributorIdentity[] = rows
        .filter((row): row is RestContributor & { login: string } =>
          Boolean(row.login)
        )
        .map((row) => ({
          nodeId: row.node_id ?? null,
          databaseId: row.id ?? null,
          login: row.login,
          avatarUrl: row.avatar_url ?? null,
          profileUrl: row.html_url ?? `https://github.com/${row.login}`,
          source: "commits",
          occurredAt: new Date().toISOString(),
          contributions: row.contributions ?? null,
          accountType: row.type ?? "User",
        }));
      await upsertManagedContributors(repositoryId, identities);
      if (rows.length < PAGE_SIZE) break;
      if (page === MAX_PAGES) truncated = true;
    }
    const contributors = await listManagedContributors(repositoryId);
    await updateContributorSyncState(repositoryId, {
      contributorSyncStatus: "complete",
      contributorSyncedAt: new Date().toISOString(),
      contributorCount: contributors.length,
    });
    return { count: contributors.length, truncated };
  } catch (error) {
    await updateContributorSyncState(repositoryId, {
      contributorSyncStatus: "failed",
    });
    throw error;
  }
}
