import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { requireAdminPage } from "@/lib/admin/auth";
import { listManagedRepositories } from "@/lib/admin/repository-store";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [session, repositories] = await Promise.all([
    requireAdminPage(),
    listManagedRepositories(),
  ]);
  return (
    <AdminDashboard
      initialRepositories={repositories}
      adminUser={session.user}
    />
  );
}
