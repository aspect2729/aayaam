import { actorFromToken } from "@/server/auth";
import { getDb } from "@/server/db";
import { AppError, isAppError } from "@/server/errors";

export function readSessionToken(request: Request): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
  const row = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("aayaam_session="));
  return row?.slice("aayaam_session=".length);
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `aayaam_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}${secure}`;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("host");
  if (!host || new URL(origin).host !== host) {
    throw new AppError(403, "BAD_ORIGIN", "Cross-site request blocked");
  }
}

export function requireActor(request: Request) {
  const actor = actorFromToken(getDb(), readSessionToken(request));
  if (!actor) throw new AppError(401, "UNAUTHENTICATED", "Sign in required");
  return actor;
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers });
}

export function errorResponse(error: unknown) {
  if (isAppError(error)) {
    return json({ error: { code: error.code, message: error.message } }, error.status);
  }
  console.error(error);
  return json({ error: { code: "INTERNAL", message: "Something went wrong" } }, 500);
}
