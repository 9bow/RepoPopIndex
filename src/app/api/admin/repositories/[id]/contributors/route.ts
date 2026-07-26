import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod/v4";
import { inngest } from "@/inngest/client";
import { requireAdminApi } from "@/lib/admin/api-auth";
import {
  listManagedContributors,
  setContributorInternalStatus,
} from "@/lib/admin/contributor-store";
import { getManagedRepository } from "@/lib/admin/repository-store";

const UpdateSchema = z.object({
  contributorId: z.string().min(1),
  internal: z.boolean(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!(await getManagedRepository(id))) {
    return NextResponse.json({ error: "저장소를 찾을 수 없습니다." }, { status: 404 });
  }
  const contributors = await listManagedContributors(id);
  return NextResponse.json({
    contributors,
    summary: {
      total: contributors.length,
      internal: contributors.filter((contributor) => contributor.internal).length,
      other: contributors.filter((contributor) => !contributor.internal).length,
    },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = requireAdminApi(request);
  if (auth.response) return auth.response;
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값을 확인해주세요." }, { status: 400 });
  }
  const { id } = await context.params;
  const contributor = await setContributorInternalStatus(
    id,
    parsed.data.contributorId,
    parsed.data.internal,
    auth.session!.user
  );
  if (!contributor) {
    return NextResponse.json({ error: "기여자를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ contributor });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!(await getManagedRepository(id))) {
    return NextResponse.json({ error: "저장소를 찾을 수 없습니다." }, { status: 404 });
  }
  await inngest.send({
    name: "admin/contributors.sync",
    data: { repositoryId: id },
  });
  return NextResponse.json({ status: "queued" }, { status: 202 });
}
