import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest, NextResponse } from "next/server";

export const ADMIN_SESSION_COOKIE = "rpi-admin-session";
const SESSION_DURATION_SECONDS = 12 * 60 * 60;

interface AdminSession {
  user: string;
  expiresAt: number;
}

function sessionSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET?.trim() || null;
}

function encodeSession(session: AdminSession): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export function adminAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim() && sessionSecret());
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  return Boolean(expected) && safeEqual(password, expected);
}

export function createAdminSession(): string {
  const secret = sessionSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  const payload = encodeSession({
    user: process.env.ADMIN_USER?.trim() || "admin",
    expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000,
  });
  return `${payload}.${sign(payload, secret)}`;
}

export function readAdminSession(value: string | undefined): AdminSession | null {
  const secret = sessionSecret();
  if (!value || !secret) return null;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!safeEqual(signature, sign(payload, secret))) return null;
  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as AdminSession;
    if (
      typeof session.user !== "string" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setAdminSessionCookie(response: NextResponse, value: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export function adminSessionFromRequest(
  request: NextRequest
): AdminSession | null {
  return readAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function requireAdminPage(): Promise<AdminSession> {
  const store = await cookies();
  const session = readAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");
  return session;
}
