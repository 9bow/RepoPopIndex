import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { getManagedRepository } from "@/lib/admin/repository-store";
import { enqueueManagedAnalysis } from "@/lib/admin/run-managed-analysis";
import { canEnqueue, getQueueDepth, MAX_QUEUE_DEPTH } from "@/lib/queue";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const repository = await getManagedRepository(id);
  if (!repository) {
    return NextResponse.json({ error: "저장소를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!(await canEnqueue())) {
    return NextResponse.json(
      {
        error: `분석 대기열이 가득 찼습니다. (${await getQueueDepth()}/${MAX_QUEUE_DEPTH})`,
      },
      { status: 503, headers: { "Retry-After": "30" } }
    );
  }
  const analysisId = await enqueueManagedAnalysis(repository, "manual");
  return NextResponse.json({ analysisId, status: "queued" }, { status: 202 });
}
