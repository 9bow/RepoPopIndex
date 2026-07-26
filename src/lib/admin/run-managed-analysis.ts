import { createAnalysis } from "@/lib/analysis-store";
import { inngest } from "@/inngest/client";
import { enqueue } from "@/lib/queue";
import type { ManagedRepository } from "./types";
import { nextMonthlyRun } from "./schedule";
import { updateManagedRepositoryRun } from "./repository-store";

export async function enqueueManagedAnalysis(
  repository: ManagedRepository,
  source: "manual" | "schedule"
): Promise<string> {
  const inputUrl = `https://github.com/${repository.owner}/${repository.repo}`;
  const analysisId = await createAnalysis({
    platform: repository.platform,
    owner: repository.owner,
    repo: repository.repo,
    period: repository.period,
    inputUrl,
  });
  await enqueue(analysisId);
  await inngest.send({
    name: "analysis/run",
    data: {
      analysisId,
      platform: repository.platform,
      owner: repository.owner,
      repo: repository.repo,
      period: repository.period,
      managedRepositoryId: repository.id,
      triggerSource: source,
    },
  });
  const now = new Date();
  await updateManagedRepositoryRun(repository.id, {
    lastRunAt: now.toISOString(),
    lastAnalysisId: analysisId,
    lastStatus: "queued",
    nextRunAt: nextMonthlyRun(now, repository.scheduleDay).toISOString(),
  });
  return analysisId;
}
