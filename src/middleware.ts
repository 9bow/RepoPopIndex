import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Locale } from "@/lib/i18n/dictionary";

const LOCALE_COOKIE = "rpi-locale";
const LOCALE_HEADER = "x-rpi-locale";

function detectFromAcceptLanguage(header: string | null): Locale {
  if (!header || !header.trim()) return "en";
  const first = header.split(",")[0]?.trim().toLowerCase() ?? "";
  const code = first.split("-")[0] ?? "";
  return code === "ko" ? "ko" : "en";
}

export function middleware(request: NextRequest) {
  const cookieVal = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale: Locale =
    cookieVal === "ko" || cookieVal === "en"
      ? cookieVal
      : detectFromAcceptLanguage(request.headers.get("accept-language"));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (!request.cookies.get(LOCALE_COOKIE)) {
    res.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
