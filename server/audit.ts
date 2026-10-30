import type Database from "better-sqlite3";
import { nowIso, type Actor } from "@/server/db";

export function audit(
  db: Database.Database,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string,
  detail: unknown
) {
  db.prepare(
    `INSERT INTO audit_events (id, business_id, actor_user_id, action, entity_type, entity_id, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), actor.businessId, actor.userId, action, entityType, entityId, JSON.stringify(detail), nowIso());
}

export function businessRow(db: Database.Database, businessId: string) {
  const row = db.prepare(`SELECT * FROM businesses WHERE id = ?`).get(businessId) as
    | {
        id: string;
        organization_id: string;
        name: string;
        ecommerce_billing: number;
        currency: string;
        timezone: string;
        default_tax_bps: number;
        financial_year_start_month: number;
        gstin: string | null;
        city: string;
        business_type: string;
        invoice_on_paid_order: number;
      }
    | undefined;
  if (!row) throw new Error("business missing");
  return row;
}
