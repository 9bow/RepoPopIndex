import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod/v4";
import {
  adminAuthConfigured,
  createAdminSession,
  setAdminSessionCookie,
  verifyAdminPassword,
} from "@/lib/admin/auth";
import { redis } from "@/lib/rate-limiter";

const LoginSchema = z.object({
  password: z.string().min(1),
});
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

function attemptKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const client = forwarded?.split(",")[0]?.trim() || "unknown";
  const digest = createHash("sha256").update(client).digest("hex").slice(0, 24);
  return `rpi:admin:login-attempts:${digest}`;
}

export async function POST(request: Request) {
  if (!adminAuthConfigured()) {
    return NextResponse.json(
      { error: "관리자 인증 환경변수가 설정되지 않았습니다." },
      { status: 503 }
    );
  }
  const key = attemptKey(request);
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, WINDOW_SECONDS);
  if (attempts > MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요." },
      {
        status: 429,
        headers: { "Retry-After": String(WINDOW_SECONDS) },
      }
    );
  }
  const parsed = LoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !verifyAdminPassword(parsed.data.password)) {
    return NextResponse.json(
      { error: "관리자 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }
  await redis.del(key);
  const response = NextResponse.json({ ok: true });
  setAdminSessionCookie(response, createAdminSession());
  return response;
}
