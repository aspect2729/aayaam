import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/register", "/privacy", "/terms", "/api/auth/login", "/api/auth/register", "/api/auth/reset", "/api/auth/session", "/api/auth/logout", "/api/webhooks", "/api/activity", "/api/health", "/api/system/status", "/api/outreach"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return NextResponse.next();
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname === "/icon") return NextResponse.next();
  if (!pathname.startsWith("/api/")) return NextResponse.next();
  const token = request.cookies.get("aayaam_session");
  if (token) return NextResponse.next();
  return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required" } }, { status: 401 });
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
