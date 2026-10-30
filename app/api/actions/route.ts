import { dispatchAction } from "@/server/dispatch";
import { getDb } from "@/server/db";
import { assertSameOrigin, errorResponse, json, requireActor } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = requireActor(request);
    const body = (await request.json()) as { action?: string; input?: Record<string, unknown> };
    if (!body.action) return json({ error: { code: "INVALID_INPUT", message: "Action is required" } }, 422);
    const result = dispatchAction(getDb(), actor, body.action, body.input ?? {});
    if (body.action === "backup.create" && result && typeof result === "object" && "payload" in result) {
      const { payload: _payload, ...safe } = result as { payload: unknown };
      return json({ result: safe });
    }
    return json({ result });
  } catch (error) {
    return errorResponse(error);
  }
}
