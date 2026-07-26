import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import {
  getReportBackup,
  readBackupArtifact,
} from "@/lib/admin/backup-store";

type RouteContext = {
  params: Promise<{ id: string; backupId: string; kind: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id, backupId, kind } = await context.params;
  if (!["json", "csv", "xlsx"].includes(kind)) {
    return NextResponse.json({ error: "지원하지 않는 파일 형식입니다." }, { status: 400 });
  }
  const backup = await getReportBackup(id, backupId);
  const artifact = backup?.artifacts.find((item) => item.kind === kind);
  if (!backup || !artifact) {
    return NextResponse.json({ error: "백업 파일을 찾을 수 없습니다." }, { status: 404 });
  }
  const result = await readBackupArtifact(artifact.pathname);
  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ error: "백업 파일을 읽을 수 없습니다." }, { status: 404 });
  }
  const extension = artifact.kind;
  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": artifact.contentType,
      "Content-Disposition": `attachment; filename="${backup.owner}-${backup.repo}-${backup.month}.${extension}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
