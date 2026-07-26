import type { AnalysisStatus, Period, Platform } from "@/lib/types";

export interface ManagedRepository {
  id: string;
  platform: Platform;
  owner: string;
  repo: string;
  period: Period;
  enabled: boolean;
  scheduleDay: number;
  timezone: string;
  nextRunAt: string;
  lastRunAt: string | null;
  lastAnalysisId: string | null;
  lastStatus: AnalysisStatus | null;
  contributorSyncStatus: "idle" | "queued" | "syncing" | "complete" | "failed";
  contributorSyncedAt: string | null;
  contributorCount: number;
  backupStatus: "idle" | "complete" | "failed";
  backupError: string | null;
  lastBackupAt: string | null;
  backupCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedContributor {
  id: string;
  nodeId: string | null;
  databaseId: number | null;
  login: string;
  avatarUrl: string | null;
  profileUrl: string;
  accountType: string;
  contributions: number | null;
  sources: Array<"commits" | "issues" | "pull_requests">;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  internal: boolean;
  internalUpdatedAt: string | null;
  internalUpdatedBy: string | null;
}

export interface StargazerProfile {
  id: string;
  nodeId: string;
  databaseId: number | null;
  login: string;
  avatarUrl: string | null;
  profileUrl: string;
  accountCreatedAt: string;
  starredAt: string;
  accountAgeDaysAtStar: number;
}

export interface StargazerDistribution {
  sampledAt: string;
  sampledCount: number;
  totalStars: number;
  status: "complete" | "partial" | "cached" | "unavailable";
  error: string | null;
  oldestStarredAt: string | null;
  newestStarredAt: string | null;
  ageBuckets: Array<{ label: string; minDays: number; maxDays: number | null; count: number }>;
  signupMonths: Array<{ month: string; count: number }>;
  starMonths: Array<{ month: string; count: number }>;
  youngAccountRatios: {
    under7Days: number;
    under30Days: number;
    under90Days: number;
  };
}

export interface BackupArtifact {
  pathname: string;
  kind: "json" | "csv" | "xlsx";
  contentType: string;
  size: number;
}

export interface ReportBackup {
  id: string;
  repositoryId: string;
  owner: string;
  repo: string;
  platform: Platform;
  period: Period;
  month: string;
  analysisId: string;
  reportStatus: AnalysisStatus;
  compositeScore: number;
  createdAt: string;
  artifacts: BackupArtifact[];
}
