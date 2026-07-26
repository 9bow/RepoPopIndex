import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod/v4";
import { requireAdminApi } from "@/lib/admin/api-auth";
import {
  listManagedRepositories,
  registerManagedRepository,
} from "@/lib/admin/repository-store";
import { parseRepoUrl } from "@/lib/parsers/url-parser";
import { inngest } from "@/inngest/client";

const RegisterSchema = z.object({
  url: z.string().min(1),
  period: z.enum(["1w", "1m", "3m", "6m", "1y"]).default("1y"),
  scheduleDay: z.coerce.number().int().min(1).max(28).default(1),
  enabled: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const auth = requireAdminApi(request);
  if (auth.response) return auth.response;
  return NextResponse.json({ repositories: await listManagedRepositories() });
}

export async function POST(request: NextRequest) {
  const auth = requireAdminApi(request);
  if (auth.response) return auth.response;
  const parsed = RegisterSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "입력값을 확인해주세요.", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const repository = parseRepoUrl(parsed.data.url);
    if (repository.platform !== "github") {
      return NextResponse.json(
        { error: "현재 관리 기능은 GitHub 저장소를 지원합니다." },
        { status: 400 }
      );
    }
    const record = await registerManagedRepository({
      ...repository,
      period: parsed.data.period,
      scheduleDay: parsed.data.scheduleDay,
      enabled: parsed.data.enabled,
    });
    await inngest.send([
      {
        name: "admin/contributors.sync",
        data: { repositoryId: record.id },
      },
      {
        name: "admin/stargazers.sync",
        data: { repositoryId: record.id },
      },
    ]);
    return NextResponse.json({ repository: record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "등록에 실패했습니다." },
      { status: 400 }
    );
  }
}
