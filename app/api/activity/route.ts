import { getDb, nowIso } from "@/server/db";
import { assertSameOrigin, errorResponse, json } from "@/server/http";
import { insertSupabaseActivity, supabaseConfigured } from "@/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as { businessId?: string; action?: string; detail?: string };
    if (!body.action || !body.detail || !body.businessId) {
      return json({ error: { code: "INVALID_INPUT", message: "Action, detail, and business are required" } }, 422);
    }
    const db = getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      business_key TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
    const row = {
      id: crypto.randomUUID(),
      business_key: body.businessId,
      action: body.action.slice(0, 80),
      detail: body.detail.slice(0, 500),
      created_at: nowIso(),
    };
    db.prepare(`INSERT INTO activity_log (id, business_key, action, detail, created_at) VALUES (?, ?, ?, ?, ?)`).run(
      row.id,
      row.business_key,
      row.action,
      row.detail,
      row.created_at
    );
    const remote = await insertSupabaseActivity(row);
    return json({ ok: true, id: row.id, supabase: supabaseConfigured() ? remote.reason : "Not configured" });
  } catch (error) {
    return errorResponse(error);
  }
}
