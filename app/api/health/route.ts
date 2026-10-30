import { getDb } from "@/server/db";
import { errorResponse, json } from "@/server/http";
import { supabaseStatus } from "@/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      business_key TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
    const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total;
    return json({
      database: "sqlite",
      file: "data/aayaam.sqlite",
      businesses: count("businesses"),
      customers: count("customers"),
      leads: count("leads"),
      tasks: count("tasks"),
      activity: count("activity_log"),
      supabase: await supabaseStatus(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
