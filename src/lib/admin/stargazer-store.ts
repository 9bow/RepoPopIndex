import { redis } from "@/lib/rate-limiter";
import type { StargazerDistribution, StargazerProfile } from "./types";

function profilesKey(repositoryId: string): string {
  return `rpi:admin:stargazers:${repositoryId}`;
}

function distributionKey(repositoryId: string): string {
  return `rpi:admin:stargazer-distribution:${repositoryId}`;
}

export async function saveStargazerProfiles(
  repositoryId: string,
  profiles: StargazerProfile[],
  distribution: StargazerDistribution
): Promise<void> {
  await redis.del(profilesKey(repositoryId));
  const values = Object.fromEntries(
    profiles.map((profile) => [profile.id, profile])
  );
  const entries = Object.entries(values);
  for (let index = 0; index < entries.length; index += 100) {
    await redis.hset(
      profilesKey(repositoryId),
      Object.fromEntries(entries.slice(index, index + 100))
    );
  }
  await redis.set(distributionKey(repositoryId), distribution);
}

export async function getStargazerProfiles(
  repositoryId: string
): Promise<StargazerProfile[]> {
  const stored = await redis.hgetall<Record<string, StargazerProfile>>(
    profilesKey(repositoryId)
  );
  return Object.values(stored ?? {}).sort((left, right) =>
    right.starredAt.localeCompare(left.starredAt)
  );
}

export async function getStargazerDistribution(
  repositoryId: string
): Promise<StargazerDistribution | null> {
  return await redis.get<StargazerDistribution>(
    distributionKey(repositoryId)
  );
}

export async function markStargazerCacheStale(
  repositoryId: string,
  error: string
): Promise<StargazerDistribution | null> {
  const existing = await getStargazerDistribution(repositoryId);
  if (!existing) return null;
  const updated: StargazerDistribution = {
    ...existing,
    status: "cached",
    error,
  };
  await redis.set(distributionKey(repositoryId), updated);
  return updated;
}
