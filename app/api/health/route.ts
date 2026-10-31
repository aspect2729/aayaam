import { getDb } from "@/server/db";
import { json } from "@/server/http";
import { supabaseStatus } from "@/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let local = "Local database is not available on this server.";
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
    local = `Local database has ${count("businesses")} businesses, ${count("customers")} customers, ${count("leads")} leads, ${count("tasks")} tasks, and ${count("activity_log")} saved actions.`;
  } catch {
    local = "Local database is not available on this server.";
  }
  const supabase = await supabaseStatus();
  return json({
    database: local.startsWith("Local database has") ? "sqlite" : "unavailable",
    local,
    supabase,
    migrations: "Supabase holds the activity tables only after 001_activity.sql is applied. Outreach and ledger tables are local until a Postgres migration is run.",
    backup: "No backup has been run from this server.",
  });
}
