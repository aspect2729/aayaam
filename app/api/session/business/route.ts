import { switchBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { assertSameOrigin, errorResponse, json, readSessionToken, requireActor } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requireActor(request);
    const token = readSessionToken(request);
    const body = (await request.json()) as { businessId?: string };
    if (!token || !body.businessId) return json({ error: { code: "INVALID_INPUT", message: "Choose a business" } }, 422);
    switchBusiness(getDb(), token, body.businessId);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
