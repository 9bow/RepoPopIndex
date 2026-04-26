import { inngest } from "../client";
import type { Period, Platform } from "@/lib/types";

interface AnalysisEvent {
  data: {
    analysisId: string;
    platform: Platform;
    owner: string;
    repo: string;
    period: Period;
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
  async ({ event }: { event: AnalysisEvent }) => {
    const { analysisId, platform, owner, repo, period } = event.data;

    const { runAnalysis } = await import("@/lib/orchestrator");
    await runAnalysis({ analysisId, platform, owner, repo, period });

    return { analysisId, status: "done" };
  }
);
