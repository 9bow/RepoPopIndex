import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report/report-view";
import { requireAdminPage } from "@/lib/admin/auth";
import {
  getReportBackup,
  loadReportFromBackup,
} from "@/lib/admin/backup-store";

export const dynamic = "force-dynamic";

export default async function ArchivedReportPage({
  params,
}: {
  params: Promise<{ id: string; backupId: string }>;
}) {
  await requireAdminPage();
  const { id, backupId } = await params;
  const [backup, report] = await Promise.all([
    getReportBackup(id, backupId),
    loadReportFromBackup(id, backupId),
  ]);
  if (!backup || !report) notFound();
  return (
    <div className="min-h-screen bg-[#f2f0e8]">
      <div className="sticky top-0 z-50 border-b border-[#173b33]/20 bg-[#f2f0e8]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c45a33]">
              보관 리포트 · {backup.month}
            </p>
            <p className="text-sm text-[#173b33]/70">
              파일 백업에서 복원한 읽기 전용 화면입니다.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-[#173b33]/25 px-4 py-2 text-sm font-medium text-[#173b33] hover:bg-[#173b33] hover:text-white"
          >
            관리 페이지로 돌아가기
          </Link>
        </div>
      </div>
      <ReportView report={report} />
    </div>
  );
}
