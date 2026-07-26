import { NextResponse, type NextRequest } from "next/server";
import { adminSessionFromRequest } from "./auth";

export function requireAdminApi(request: NextRequest) {
  const session = adminSessionFromRequest(request);
  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "관리자 인증이 필요합니다." },
        { status: 401 }
      ),
    };
  }
  return { session, response: null };
}
