import { inngest } from "../client";
import type { AnalysisReport } from "@/lib/types";

export const syncManagedContributors = inngest.createFunction(
  {
    id: "sync-managed-contributors",
    triggers: [{ event: "admin/contributors.sync" }],
    concurrency: { limit: 2 },
  },
  async ({ event, step }) => {
    return await step.run("sync-contributors", async () => {
      const { syncGitHubContributors } = await import(
        "@/lib/admin/github-contributor-sync"
      );
      return await syncGitHubContributors(event.data.repositoryId);
    });
  }
);

export const syncManagedStargazers = inngest.createFunction(
  {
    id: "sync-managed-stargazers",
    triggers: [{ event: "admin/stargazers.sync" }],
    concurrency: { limit: 2 },
  },
  async ({ event, step }) => {
    return await step.run("sync-stargazers", async () => {
      const { syncStargazerProfiles } = await import(
        "@/lib/admin/stargazer-sync"
      );
      return await syncStargazerProfiles(event.data.repositoryId);
    });
  }
);

export const finalizeManagedReport = inngest.createFunction(
  {
    id: "finalize-managed-report",
    triggers: [{ event: "admin/report.finalize" }],
    concurrency: { limit: 2 },
  },
  async ({ event, step }) => {
    const { repositoryId, analysisId } = event.data;
    const contributorSync = await step.run("refresh-contributors", async () => {
      try {
        const { syncGitHubContributors } = await import(
          "@/lib/admin/github-contributor-sync"
        );
        return await syncGitHubContributors(repositoryId);
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });
    const stargazerSync = await step.run("refresh-stargazers", async () => {
      try {
        const { syncStargazerProfiles } = await import(
          "@/lib/admin/stargazer-sync"
        );
        return await syncStargazerProfiles(repositoryId);
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });
    const backup = await step.run("create-private-backup", async () => {
      const [
        { getManagedRepository },
        { cacheGet, reportCacheKey },
        { createManagedReportBackup },
      ] = await Promise.all([
        import("@/lib/admin/repository-store"),
        import("@/lib/cache"),
        import("@/lib/admin/backup-store"),
      ]);
      const repository = await getManagedRepository(repositoryId);
      if (!repository) throw new Error("Managed repository not found");
      const report = await cacheGet<AnalysisReport>(
        reportCacheKey(
          repository.platform,
          repository.owner,
          repository.repo,
          repository.period
        )
      );
      if (!report || report.id !== analysisId) {
        throw new Error("Completed report is unavailable for backup");
      }
      return await createManagedReportBackup(repositoryId, report);
    });
    return { contributorSync, stargazerSync, backup };
  }
);

export const runManagedRepositorySchedule = inngest.createFunction(
  {
    id: "run-managed-repository-schedule",
    triggers: [{ cron: "0 1 * * *" }],
  },
  async ({ step }) => {
    const due = await step.run("find-due-repositories", async () => {
      const { listDueManagedRepositories } = await import(
        "@/lib/admin/repository-store"
      );
      return await listDueManagedRepositories();
    });
    const results = [];
    for (const repository of due) {
      results.push(
        await step.run(`enqueue-${repository.id}`, async () => {
          const [{ canEnqueue }, { enqueueManagedAnalysis }] =
            await Promise.all([
              import("@/lib/queue"),
              import("@/lib/admin/run-managed-analysis"),
            ]);
          if (!(await canEnqueue())) {
            return { repositoryId: repository.id, status: "queue_full" };
          }
          const analysisId = await enqueueManagedAnalysis(
            repository,
            "schedule"
          );
          return { repositoryId: repository.id, analysisId, status: "queued" };
        })
      );
    }
    return { checkedAt: new Date().toISOString(), results };
  }
);
