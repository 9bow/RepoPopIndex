import { notFound } from "next/navigation";
import { ManagedRepositoryDetail } from "@/components/admin/managed-repository-detail";
import { requireAdminPage } from "@/lib/admin/auth";
import { listReportBackups } from "@/lib/admin/backup-store";
import { listManagedContributors } from "@/lib/admin/contributor-store";
import { getManagedRepository } from "@/lib/admin/repository-store";
import {
  getStargazerDistribution,
  getStargazerProfiles,
} from "@/lib/admin/stargazer-store";

export const dynamic = "force-dynamic";

export default async function ManagedRepositoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const [repository, contributors, distribution, profiles, backups] =
    await Promise.all([
      getManagedRepository(id),
      listManagedContributors(id),
      getStargazerDistribution(id),
      getStargazerProfiles(id),
      listReportBackups(id),
    ]);
  if (!repository) notFound();
  return (
    <ManagedRepositoryDetail
      initialRepository={repository}
      initialContributors={contributors}
      distribution={distribution}
      profiles={profiles}
      backups={backups}
    />
  );
}
