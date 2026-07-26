import { inngest } from "../client";
import type { Period, Platform } from "@/lib/types";

interface AnalysisEvent {
  data: {
    analysisId: string;
    platform: Platform;
    owner: string;
    repo: string;
    period: Period;
    managedRepositoryId?: string;
    triggerSource?: "manual" | "schedule";
  };
}

export const analyzeRepo = inngest.createFunction(
  {
    id: "analyze-repo",
    triggers: [{ event: "analysis/run" }],
    concurrency: {
      limit: parseInt(process.env.MAX_CONCURRENT_ANALYSES ?? "5"),
    },
  },
  async ({ event, step }) => {
    const typedEvent = event as unknown as AnalysisEvent;
    const {
      analysisId,
      platform,
      owner,
      repo,
      period,
      managedRepositoryId,
    } = typedEvent.data;

    const { runAnalysis } = await import("@/lib/orchestrator");
    await runAnalysis({
      analysisId,
      platform,
      owner,
      repo,
      period,
      managedRepositoryId,
    });

    if (managedRepositoryId) {
      const [{ getAnalysis }, { updateManagedRepositoryRun }] =
        await Promise.all([
          import("@/lib/analysis-store"),
          import("@/lib/admin/repository-store"),
        ]);
      const analysis = await getAnalysis(analysisId);
      if (analysis) {
        await updateManagedRepositoryRun(managedRepositoryId, {
          lastStatus: analysis.status,
        });
      }
      if (analysis?.status === "complete" || analysis?.status === "partial") {
        await step.sendEvent("finalize-managed-report", {
          name: "admin/report.finalize",
          data: { repositoryId: managedRepositoryId, analysisId },
        });
      }
    }

    return { analysisId, status: "done" };
  }
);
