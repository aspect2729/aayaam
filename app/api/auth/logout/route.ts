import { destroySession } from "@/server/auth";
import { getDb } from "@/server/db";
import { errorResponse, json, readSessionToken } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const token = readSessionToken(request);
    if (token) destroySession(getDb(), token);
    return json({ ok: true }, 200, { "set-cookie": "aayaam_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax" });
  } catch (error) {
    return errorResponse(error);
  }
}
