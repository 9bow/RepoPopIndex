import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod/v4";
import { requireAdminApi } from "@/lib/admin/api-auth";
import {
  deleteManagedRepository,
  getManagedRepository,
  updateManagedRepository,
} from "@/lib/admin/repository-store";

const UpdateSchema = z.object({
  enabled: z.boolean().optional(),
  period: z.enum(["1w", "1m", "3m", "6m", "1y"]).optional(),
  scheduleDay: z.coerce.number().int().min(1).max(28).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const repository = await getManagedRepository(id);
  if (!repository) {
    return NextResponse.json({ error: "저장소를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ repository });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = requireAdminApi(request);
  if (auth.response) return auth.response;
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "입력값을 확인해주세요.", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { id } = await context.params;
  const repository = await updateManagedRepository(id, parsed.data);
  if (!repository) {
    return NextResponse.json({ error: "저장소를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ repository });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const deleted = await deleteManagedRepository(id);
  if (!deleted) {
    return NextResponse.json({ error: "저장소를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    note: "등록만 제거했으며 기존 월별 백업은 보존됩니다.",
  });
}
