import { redis } from "@/lib/rate-limiter";
import type { AnalysisStatus, Period, Platform } from "@/lib/types";
import { managedRepositoryId } from "./repository-id";
import { nextMonthlyRun } from "./schedule";
import type { ManagedRepository } from "./types";

const REPOSITORIES_KEY = "rpi:admin:repositories";

export async function listManagedRepositories(): Promise<ManagedRepository[]> {
  const stored = await redis.hgetall<Record<string, ManagedRepository>>(
    REPOSITORIES_KEY
  );
  return Object.values(stored ?? {}).sort((left, right) =>
    `${left.owner}/${left.repo}`.localeCompare(`${right.owner}/${right.repo}`)
  );
}

export async function getManagedRepository(
  id: string
): Promise<ManagedRepository | null> {
  return await redis.hget<ManagedRepository>(REPOSITORIES_KEY, id);
}

export async function findManagedRepository(
  platform: Platform,
  owner: string,
  repo: string
): Promise<ManagedRepository | null> {
  return getManagedRepository(managedRepositoryId(platform, owner, repo));
}

export async function registerManagedRepository(input: {
  platform: Platform;
  owner: string;
  repo: string;
  period: Period;
  scheduleDay: number;
  enabled?: boolean;
}): Promise<ManagedRepository> {
  const now = new Date();
  const id = managedRepositoryId(input.platform, input.owner, input.repo);
  const existing = await getManagedRepository(id);
  const record: ManagedRepository = {
    id,
    platform: input.platform,
    owner: input.owner.trim(),
    repo: input.repo.trim(),
    period: input.period,
    enabled: input.enabled ?? true,
    scheduleDay: Math.min(28, Math.max(1, Math.trunc(input.scheduleDay))),
    timezone: "Asia/Seoul",
    nextRunAt: nextMonthlyRun(now, input.scheduleDay).toISOString(),
    lastRunAt: existing?.lastRunAt ?? null,
    lastAnalysisId: existing?.lastAnalysisId ?? null,
    lastStatus: existing?.lastStatus ?? null,
    contributorSyncStatus: existing?.contributorSyncStatus ?? "idle",
    contributorSyncedAt: existing?.contributorSyncedAt ?? null,
    contributorCount: existing?.contributorCount ?? 0,
    backupStatus: existing?.backupStatus ?? "idle",
    backupError: existing?.backupError ?? null,
    lastBackupAt: existing?.lastBackupAt ?? null,
    backupCount: existing?.backupCount ?? 0,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await redis.hset(REPOSITORIES_KEY, { [id]: record });
  return record;
}

export async function updateManagedRepository(
  id: string,
  fields: Partial<
    Pick<ManagedRepository, "enabled" | "period" | "scheduleDay">
  >
): Promise<ManagedRepository | null> {
  const existing = await getManagedRepository(id);
  if (!existing) return null;
  const now = new Date();
  const scheduleDay =
    fields.scheduleDay === undefined
      ? existing.scheduleDay
      : Math.min(28, Math.max(1, Math.trunc(fields.scheduleDay)));
  const updated: ManagedRepository = {
    ...existing,
    ...fields,
    scheduleDay,
    nextRunAt: nextMonthlyRun(now, scheduleDay).toISOString(),
    updatedAt: now.toISOString(),
  };
  await redis.hset(REPOSITORIES_KEY, { [id]: updated });
  return updated;
}

export async function updateManagedRepositoryRun(
  id: string,
  fields: {
    lastRunAt?: string;
    lastAnalysisId?: string;
    lastStatus?: AnalysisStatus;
    nextRunAt?: string;
  }
): Promise<void> {
  const existing = await getManagedRepository(id);
  if (!existing) return;
  const updated: ManagedRepository = {
    ...existing,
    ...fields,
    updatedAt: new Date().toISOString(),
  };
  await redis.hset(REPOSITORIES_KEY, { [id]: updated });
}

export async function updateContributorSyncState(
  id: string,
  fields: Pick<
    ManagedRepository,
    "contributorSyncStatus"
  > &
    Partial<Pick<ManagedRepository, "contributorSyncedAt" | "contributorCount">>
): Promise<void> {
  const existing = await getManagedRepository(id);
  if (!existing) return;
  await redis.hset(REPOSITORIES_KEY, {
    [id]: {
      ...existing,
      ...fields,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function updateBackupState(
  id: string,
  fields: Pick<ManagedRepository, "backupStatus"> &
    Partial<
      Pick<
        ManagedRepository,
        "backupError" | "lastBackupAt" | "backupCount"
      >
    >
): Promise<void> {
  const existing = await getManagedRepository(id);
  if (!existing) return;
  await redis.hset(REPOSITORIES_KEY, {
    [id]: {
      ...existing,
      ...fields,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function deleteManagedRepository(id: string): Promise<boolean> {
  return (await redis.hdel(REPOSITORIES_KEY, id)) > 0;
}

export async function listDueManagedRepositories(
  now = new Date()
): Promise<ManagedRepository[]> {
  const repositories = await listManagedRepositories();
  return repositories.filter(
    (repository) =>
      repository.enabled &&
      new Date(repository.nextRunAt).getTime() <= now.getTime()
  );
}
