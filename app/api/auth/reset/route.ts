import { requestPasswordReset, resetPassword } from "@/server/auth";
import { getDb } from "@/server/db";
import { assertSameOrigin, errorResponse, json } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as { email?: string; token?: string; password?: string };
    const db = getDb();
    if (body.token && body.password) {
      resetPassword(db, body.token, body.password);
      return json({ ok: true });
    }
    if (!body.email) return json({ error: { code: "INVALID_INPUT", message: "Email is required" } }, 422);
    requestPasswordReset(db, body.email);
    return json({
      ok: true,
      delivered: false,
      message: "If the account exists, a reset was stored. Email delivery is not configured, so nothing was sent.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
