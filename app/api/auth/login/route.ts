import { login } from "@/server/auth";
import { getDb } from "@/server/db";
import { assertSameOrigin, errorResponse, json, sessionCookie } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) return json({ error: { code: "INVALID_INPUT", message: "Email and password are required" } }, 422);
    const token = login(getDb(), body.email, body.password);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
  } catch (error) {
    return errorResponse(error);
  }
}
