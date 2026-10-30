import type Database from "better-sqlite3";
import { audit } from "@/server/audit";
import type { Actor } from "@/server/db";
import { nowIso } from "@/server/db";
import { accountBalance, customerBookBalance, reconciliationIssues } from "@/server/finance";
import { formatInr, percentChange } from "@/server/money";
import { assertPermission } from "@/server/permissions";

export type Evidence = { entityType: string; entityId: string; label: string };
export type Insight = {
  id: string;
  title: string;
  kind: "fact" | "hypothesis";
  detail: string;
  evidence: Evidence[];
};

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function observeBusiness(db: Database.Database, actor: Actor): Insight[] {
  assertPermission(actor, "brain:view");
  const insights: Insight[] = [];
  const revenue = db
    .prepare(
      `SELECT substr(created_at, 1, 7) AS month, COALESCE(SUM(amount_paise), 0) AS total
       FROM ledger_entries
       WHERE business_id = ? AND account = 'revenue' AND direction = 'credit' AND reversal_of IS NULL
       GROUP BY month ORDER BY month`
    )
    .all(actor.businessId) as Array<{ month: string; total: number }>;
  if (revenue.length >= 2) {
    const latest = revenue[revenue.length - 1];
    const previous = revenue[revenue.length - 2];
    const change = percentChange(latest.total, previous.total);
    if (change !== null && change <= -10) {
      insights.push({
        id: "revenue-decline",
        title: `Revenue credits fell ${Math.abs(change)}% from ${previous.month} to ${latest.month}`,
        kind: "fact",
        detail: `${formatInr(previous.total)} then ${formatInr(latest.total)}. This is posted revenue, not profit.`,
        evidence: [{ entityType: "ledger", entityId: latest.month, label: "revenue credits" }],
      });
      insights.push({
        id: "revenue-hypothesis",
        title: "The cause is not established from revenue alone",
        kind: "hypothesis",
        detail: "Compare lead conversion, fulfilled orders, and refunds before treating this as a demand problem.",
        evidence: [],
      });
    }
  }
  const stuck = db
    .prepare(`SELECT id, name FROM leads WHERE business_id = ? AND stage = 'new' AND created_at < ?`)
    .all(actor.businessId, new Date(Date.now() - 2 * 86400000).toISOString()) as Array<{ id: string; name: string }>;
  if (stuck.length) {
    insights.push({
      id: "stuck-leads",
      title: `${stuck.length} new lead${stuck.length === 1 ? "" : "s"} have had no stage change for 2 days`,
      kind: "fact",
      detail: stuck.map((lead) => lead.name).join(", "),
      evidence: stuck.slice(0, 5).map((lead) => ({ entityType: "lead", entityId: lead.id, label: lead.name })),
    });
  }
  const low = db
    .prepare(
      `SELECT v.id, v.name, b.quantity_milli FROM stock_balances b
       JOIN product_variants v ON v.id = b.variant_id
       WHERE b.business_id = ? AND b.quantity_milli <= 5000`
    )
    .all(actor.businessId) as Array<{ id: string; name: string; quantity_milli: number }>;
  if (low.length) {
    insights.push({
      id: "low-stock",
      title: `${low.length} variant${low.length === 1 ? "" : "s"} at or below 5 units`,
      kind: "fact",
      detail: low.map((row) => `${row.name}: ${(row.quantity_milli / 1000).toFixed(3)}`).join(", "),
      evidence: low.slice(0, 5).map((row) => ({ entityType: "variant", entityId: row.id, label: row.name })),
    });
  }
  const issues = reconciliationIssues(db, actor.businessId);
  if (issues.length) {
    insights.push({
      id: "reconciliation",
      title: `${issues.length} reconciliation item${issues.length === 1 ? "" : "s"} need a person`,
      kind: "fact",
      detail: issues.map((issue) => issue.message).slice(0, 4).join(" "),
      evidence: issues.slice(0, 5).map((issue) => ({ entityType: "reconciliation", entityId: issue.entityId, label: issue.code })),
    });
  }
  const ar = accountBalance(db, actor.businessId, "accounts_receivable");
  if (ar.netDebitPaise > 0) {
    insights.push({
      id: "receivables",
      title: `Accounts receivable net to ${formatInr(ar.netDebitPaise)}`,
      kind: "fact",
      detail: "This is the ledger balance. Pending UPI is not included until it is booked.",
      evidence: [{ entityType: "ledger", entityId: "accounts_receivable", label: "accounts receivable" }],
    });
  }
  const customers = db.prepare(`SELECT id, name FROM customers WHERE business_id = ? AND archived_at IS NULL`).all(actor.businessId) as Array<{
    id: string;
    name: string;
  }>;
  const overdue = customers
    .map((customer) => ({ ...customer, due: customerBookBalance(db, actor.businessId, customer.id) }))
    .filter((customer) => customer.due > 0);
  if (overdue.length) {
    insights.push({
      id: "customer-dues",
      title: `${overdue.length} customer${overdue.length === 1 ? "" : "s"} have a book balance`,
      kind: "fact",
      detail: overdue.map((customer) => `${customer.name} ${formatInr(customer.due)}`).join(", "),
      evidence: overdue.slice(0, 5).map((customer) => ({ entityType: "customer", entityId: customer.id, label: customer.name })),
    });
  }
  return insights;
}

export function runBrain(db: Database.Database, actor: Actor) {
  const insights = observeBusiness(db, actor);
  const mode = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY ? "model" : "deterministic";
  const output = {
    mode: mode === "model" ? "deterministic" : "deterministic",
    note:
      mode === "model"
        ? "A provider key is present, but financial figures still come from the ledger. No model call was made for the numbers."
        : "No model provider is configured. These observations are queries over posted records.",
    insights,
    month: monthKey(nowIso()),
  };
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO ai_runs (id, business_id, kind, mode, input_json, output_json, created_at) VALUES (?, ?, 'observe', 'deterministic', '{}', ?, ?)`).run(
    id,
    actor.businessId,
    JSON.stringify(output),
    nowIso()
  );
  audit(db, actor, "brain.observe", "ai_run", id, { insights: insights.length });
  return { id, ...output };
}

export function proposeHighImpact(db: Database.Database, actor: Actor, action: string, payload: unknown) {
  assertPermission(actor, "brain:create");
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO approvals (id, business_id, action, payload_json, status, requested_by, decided_by, result_json, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?, NULL, NULL, ?)`
  ).run(id, actor.businessId, action, JSON.stringify(payload), actor.userId, nowIso());
  audit(db, actor, "approval.requested", "approval", id, { action });
  return db.prepare(`SELECT * FROM approvals WHERE id = ?`).get(id);
}
