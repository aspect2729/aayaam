import { createHash } from "crypto";
import type Database from "better-sqlite3";
import { audit } from "@/server/audit";
import { openDatabase, type Actor } from "@/server/db";
import { nowIso } from "@/server/db";
import { AppError } from "@/server/errors";
import { assertPermission } from "@/server/permissions";

const tables = [
  "organizations",
  "businesses",
  "branches",
  "expense_categories",
  "customers",
  "suppliers",
  "leads",
  "lead_activities",
  "products",
  "product_variants",
  "inventory_locations",
  "stock_balances",
  "stock_movements",
  "ecommerce_stores",
  "ecommerce_orders",
  "ecommerce_order_items",
  "invoice_sequences",
  "invoices",
  "invoice_items",
  "payment_transactions",
  "payment_allocations",
  "refunds",
  "credit_notes",
  "ledger_entries",
  "expenses",
  "tasks",
];

export function exportBusiness(db: Database.Database, actor: Actor) {
  assertPermission(actor, "backup:export");
  const business = db.prepare(`SELECT * FROM businesses WHERE id = ?`).get(actor.businessId) as { organization_id: string };
  const payload: Record<string, unknown[]> = {
    organizations: db.prepare(`SELECT * FROM organizations WHERE id = ?`).all(business.organization_id),
    businesses: [business],
  };
  for (const table of tables) {
    if (table === "organizations" || table === "businesses") continue;
    payload[table] = db.prepare(`SELECT * FROM ${table} WHERE business_id = ?`).all(actor.businessId);
  }
  const body = JSON.stringify(payload);
  const sha256 = createHash("sha256").update(body).digest("hex");
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO backup_snapshots (id, business_id, sha256, payload_json, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    actor.businessId,
    sha256,
    body,
    nowIso()
  );
  audit(db, actor, "backup.created", "backup", id, { sha256, tables: tables.length });
  return { id, sha256, payload };
}

export function restoreSnapshot(snapshot: { sha256: string; payload: Record<string, Array<Record<string, unknown>>> }, filename = ":memory:") {
  const body = JSON.stringify(snapshot.payload);
  const actual = createHash("sha256").update(body).digest("hex");
  if (actual !== snapshot.sha256) throw new AppError(422, "BACKUP_TAMPERED", "Snapshot hash does not match its contents");
  const target = openDatabase(filename);
  const businessIds = new Set<string>();
  for (const rows of Object.values(snapshot.payload)) {
    for (const row of rows) {
      if (typeof row.business_id === "string") businessIds.add(row.business_id);
    }
  }
  if (businessIds.size !== 1) throw new AppError(422, "BACKUP_SCOPE", "A snapshot must contain exactly one business");
  const insertOrder = tables;
  const run = target.transaction(() => {
    for (const table of insertOrder) {
      const rows = snapshot.payload[table] ?? [];
      for (const row of rows) {
        const keys = Object.keys(row);
        const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
        target.prepare(sql).run(...keys.map((key) => row[key] as never));
      }
    }
  });
  run();
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const count = target.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number };
    counts[table] = count.total;
    if (counts[table] !== (snapshot.payload[table]?.length ?? 0)) {
      throw new AppError(500, "RESTORE_MISMATCH", `${table} row count does not match the snapshot`);
    }
  }
  return { db: target, counts };
}

export function verifySnapshot(db: Database.Database, actor: Actor, snapshotId: string) {
  assertPermission(actor, "backup:view");
  const row = db.prepare(`SELECT * FROM backup_snapshots WHERE id = ?`).get(snapshotId) as
    | { business_id: string; sha256: string; payload_json: string }
    | undefined;
  if (!row || row.business_id !== actor.businessId) throw new AppError(404, "NOT_FOUND", "Snapshot not found");
  const payload = JSON.parse(row.payload_json) as Record<string, Array<Record<string, unknown>>>;
  const restored = restoreSnapshot({ sha256: row.sha256, payload });
  restored.db.close();
  return { ok: true, sha256: row.sha256, counts: restored.counts };
}
