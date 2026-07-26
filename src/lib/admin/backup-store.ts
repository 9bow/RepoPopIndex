import { get, put } from "@vercel/blob";
import { redis } from "@/lib/rate-limiter";
import type { AnalysisReport } from "@/lib/types";
import { listManagedContributors } from "./contributor-store";
import {
  getManagedRepository,
  updateBackupState,
} from "./repository-store";
import {
  createReportMetricsCsv,
  createReportWorkbook,
} from "./report-export";
import { getStargazerDistribution } from "./stargazer-store";
import type { BackupArtifact, ReportBackup } from "./types";

function backupIndexKey(repositoryId: string): string {
  return `rpi:admin:backups:${repositoryId}`;
}

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  return token;
}

export async function listReportBackups(
  repositoryId: string
): Promise<ReportBackup[]> {
  const stored = await redis.hgetall<Record<string, ReportBackup>>(
    backupIndexKey(repositoryId)
  );
  return Object.values(stored ?? {}).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

export async function getReportBackup(
  repositoryId: string,
  backupId: string
): Promise<ReportBackup | null> {
  return await redis.hget<ReportBackup>(
    backupIndexKey(repositoryId),
    backupId
  );
}

async function upload(
  pathname: string,
  body: string | Buffer,
  kind: BackupArtifact["kind"],
  contentType: string
): Promise<BackupArtifact> {
  await put(pathname, body, {
    access: "private",
    token: blobToken(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });
  return {
    pathname,
    kind,
    contentType,
    size: typeof body === "string" ? Buffer.byteLength(body) : body.length,
  };
}

export async function createManagedReportBackup(
  repositoryId: string,
  report: AnalysisReport
): Promise<ReportBackup> {
  const repository = await getManagedRepository(repositoryId);
  if (!repository) throw new Error("Managed repository not found");
  try {
    const [contributors, stargazers] = await Promise.all([
      listManagedContributors(repositoryId),
      getStargazerDistribution(repositoryId),
    ]);
    const month = (report.completedAt ?? report.createdAt).slice(0, 7);
    const backupId = `${month}-${report.id}`;
    const prefix = `repopopindex/${repositoryId}/${month}/${report.id}`;
    const json = JSON.stringify(report, null, 2);
    const csv = createReportMetricsCsv(report);
    const xlsx = await createReportWorkbook({
      report,
      contributors,
      stargazers,
    });
    const artifacts = await Promise.all([
      upload(`${prefix}/report.json`, json, "json", "application/json"),
      upload(`${prefix}/metrics.csv`, csv, "csv", "text/csv;charset=utf-8"),
      upload(
        `${prefix}/report.xlsx`,
        xlsx,
        "xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ),
    ]);
    const backup: ReportBackup = {
      id: backupId,
      repositoryId,
      owner: report.owner,
      repo: report.repo,
      platform: report.platform,
      period: report.period,
      month,
      analysisId: report.id,
      reportStatus: report.status,
      compositeScore: report.compositeScore,
      createdAt: new Date().toISOString(),
      artifacts,
    };
    await redis.hset(backupIndexKey(repositoryId), { [backupId]: backup });
    const backups = await listReportBackups(repositoryId);
    await updateBackupState(repositoryId, {
      backupStatus: "complete",
      backupError: null,
      lastBackupAt: backup.createdAt,
      backupCount: backups.length,
    });
    return backup;
  } catch (error) {
    await updateBackupState(repositoryId, {
      backupStatus: "failed",
      backupError: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

export async function readBackupArtifact(pathname: string) {
  return await get(pathname, {
    access: "private",
    token: blobToken(),
    useCache: true,
  });
}

export async function loadReportFromBackup(
  repositoryId: string,
  backupId: string
): Promise<AnalysisReport | null> {
  const backup = await getReportBackup(repositoryId, backupId);
  const artifact = backup?.artifacts.find((item) => item.kind === "json");
  if (!artifact) return null;
  const result = await readBackupArtifact(artifact.pathname);
  if (!result || result.statusCode !== 200) return null;
  return JSON.parse(await new Response(result.stream).text()) as AnalysisReport;
}
