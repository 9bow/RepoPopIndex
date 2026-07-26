import { redis } from "@/lib/rate-limiter";
import type { GitHubContributorIdentity } from "@/lib/types";
import type { ManagedContributor } from "./types";

function contributorKey(repositoryId: string): string {
  return `rpi:admin:contributors:${repositoryId}`;
}

function contributorId(nodeId: string | null, login: string): string {
  return Buffer.from(nodeId ?? login.toLowerCase(), "utf8").toString("base64url");
}

export async function listManagedContributors(
  repositoryId: string
): Promise<ManagedContributor[]> {
  const stored = await redis.hgetall<Record<string, ManagedContributor>>(
    contributorKey(repositoryId)
  );
  return Object.values(stored ?? {}).sort((left, right) => {
    if (left.internal !== right.internal) return left.internal ? -1 : 1;
    return left.login.localeCompare(right.login);
  });
}

export async function upsertManagedContributors(
  repositoryId: string,
  identities: GitHubContributorIdentity[]
): Promise<number> {
  if (identities.length === 0) {
    return (await listManagedContributors(repositoryId)).length;
  }
  const existing = await listManagedContributors(repositoryId);
  const byId = new Map(existing.map((contributor) => [contributor.id, contributor]));
  const updates: Record<string, ManagedContributor> = {};

  for (const identity of identities) {
    const id = contributorId(identity.nodeId, identity.login);
    const previous = byId.get(id);
    const sources = [
      ...new Set([...(previous?.sources ?? []), identity.source]),
    ];
    const firstObservedAt =
      previous?.firstObservedAt &&
      previous.firstObservedAt.localeCompare(identity.occurredAt) <= 0
        ? previous.firstObservedAt
        : identity.occurredAt;
    const lastObservedAt =
      previous?.lastObservedAt &&
      previous.lastObservedAt.localeCompare(identity.occurredAt) >= 0
        ? previous.lastObservedAt
        : identity.occurredAt;
    updates[id] = {
      id,
      nodeId: identity.nodeId,
      databaseId: identity.databaseId,
      login: identity.login,
      avatarUrl: identity.avatarUrl ?? previous?.avatarUrl ?? null,
      profileUrl: identity.profileUrl,
      accountType: identity.accountType ?? previous?.accountType ?? "User",
      contributions: identity.contributions ?? previous?.contributions ?? null,
      sources,
      firstObservedAt,
      lastObservedAt,
      internal: previous?.internal ?? false,
      internalUpdatedAt: previous?.internalUpdatedAt ?? null,
      internalUpdatedBy: previous?.internalUpdatedBy ?? null,
    };
    byId.set(id, updates[id]);
  }

  const entries = Object.entries(updates);
  for (let index = 0; index < entries.length; index += 100) {
    await redis.hset(
      contributorKey(repositoryId),
      Object.fromEntries(entries.slice(index, index + 100))
    );
  }
  return byId.size;
}

export async function setContributorInternalStatus(
  repositoryId: string,
  contributorIdValue: string,
  internal: boolean,
  updatedBy: string
): Promise<ManagedContributor | null> {
  const key = contributorKey(repositoryId);
  const contributor = await redis.hget<ManagedContributor>(
    key,
    contributorIdValue
  );
  if (!contributor) return null;
  const updated: ManagedContributor = {
    ...contributor,
    internal,
    internalUpdatedAt: new Date().toISOString(),
    internalUpdatedBy: updatedBy,
  };
  await redis.hset(key, { [contributorIdValue]: updated });
  return updated;
}
