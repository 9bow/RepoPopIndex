import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import {
  createManagedReportBackup,
  listReportBackups,
} from "@/lib/admin/backup-store";
import { getManagedRepository } from "@/lib/admin/repository-store";
import { cacheGet, reportCacheKey } from "@/lib/cache";
import type { AnalysisReport } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!(await getManagedRepository(id))) {
    return NextResponse.json({ error: "저장소를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ backups: await listReportBackups(id) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const repository = await getManagedRepository(id);
  if (!repository) {
    return NextResponse.json({ error: "저장소를 찾을 수 없습니다." }, { status: 404 });
  }
  const report = await cacheGet<AnalysisReport>(
    reportCacheKey(
      repository.platform,
      repository.owner,
      repository.repo,
      repository.period
    )
  );
  if (!report) {
    return NextResponse.json(
      { error: "백업할 최신 리포트가 없습니다. 먼저 분석을 실행해주세요." },
      { status: 404 }
    );
  }
  try {
    const backup = await createManagedReportBackup(id, report);
    return NextResponse.json({ backup }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "백업에 실패했습니다." },
      { status: 503 }
    );
  }
}
