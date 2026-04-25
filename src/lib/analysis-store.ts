import { redis } from "./rate-limiter";
import type { AnalysisStatus, Platform, Period } from "./types";

export const ANALYSIS_TTL = 30 * 24 * 3600;

export interface AnalysisRecord {
  id: string;
  platform: Platform;
  owner: string;
  repo: string;
  period: Period;
  status: AnalysisStatus;
  inputUrl: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

function analysisKey(id: string): string {
  return `rpi:analysis:${id}`;
}

export async function createAnalysis(meta: {
  platform: Platform;
  owner: string;
  repo: string;
  period: Period;
  inputUrl: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  const record: AnalysisRecord = {
    id,
    platform: meta.platform,
    owner: meta.owner,
    repo: meta.repo,
    period: meta.period,
    inputUrl: meta.inputUrl,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  await redis.set(analysisKey(id), record, { ex: ANALYSIS_TTL });
  return id;
}

export async function getAnalysis(id: string): Promise<AnalysisRecord | null> {
  return await redis.get<AnalysisRecord>(analysisKey(id));
}

export async function updateAnalysisStatus(
  id: string,
  fields: { status?: AnalysisStatus; error?: string; completedAt?: string }
): Promise<void> {
  const existing = await getAnalysis(id);
  if (!existing) return;
  const updated: AnalysisRecord = {
    ...existing,
    ...(fields.status !== undefined && { status: fields.status }),
    ...(fields.error !== undefined && { error: fields.error }),
    ...(fields.completedAt !== undefined && { completedAt: fields.completedAt }),
  };
  await redis.set(analysisKey(id), updated, { ex: ANALYSIS_TTL });
}
