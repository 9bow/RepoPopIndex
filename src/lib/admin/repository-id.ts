import type { Platform } from "@/lib/types";

export function managedRepositoryId(
  platform: Platform,
  owner: string,
  repo: string
): string {
  return Buffer.from(
    `${platform}:${owner.trim().toLowerCase()}/${repo.trim().toLowerCase()}`,
    "utf8"
  ).toString("base64url");
}

export function managedRepositoryRedisKey(
  platform: Platform,
  owner: string,
  repo: string
): string {
  return `${platform}:${owner.trim().toLowerCase()}/${repo.trim().toLowerCase()}`;
}
