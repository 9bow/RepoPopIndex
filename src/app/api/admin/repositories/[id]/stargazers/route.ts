import { NextResponse, type NextRequest } from "next/server";
import { inngest } from "@/inngest/client";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { getManagedRepository } from "@/lib/admin/repository-store";
import {
  getStargazerDistribution,
  getStargazerProfiles,
} from "@/lib/admin/stargazer-store";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!(await getManagedRepository(id))) {
    return NextResponse.json({ error: "저장소를 찾을 수 없습니다." }, { status: 404 });
  }
  const [distribution, profiles] = await Promise.all([
    getStargazerDistribution(id),
    getStargazerProfiles(id),
  ]);
  return NextResponse.json({ distribution, profiles });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!(await getManagedRepository(id))) {
    return NextResponse.json({ error: "저장소를 찾을 수 없습니다." }, { status: 404 });
  }
  await inngest.send({
    name: "admin/stargazers.sync",
    data: { repositoryId: id },
  });
  return NextResponse.json({ status: "queued" }, { status: 202 });
}
