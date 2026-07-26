import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { analyzeRepo } from "@/inngest/functions/analyze";
import {
  finalizeManagedReport,
  runManagedRepositorySchedule,
  syncManagedContributors,
  syncManagedStargazers,
} from "@/inngest/functions/admin";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    analyzeRepo,
    syncManagedContributors,
    syncManagedStargazers,
    finalizeManagedReport,
    runManagedRepositorySchedule,
  ],
});
