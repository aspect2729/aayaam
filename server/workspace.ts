import type Database from "better-sqlite3";
import type { Actor } from "@/server/db";
import type { Workspace } from "@/lib/contracts";
import { accountBalance, reconciliationIssues } from "@/server/finance";
import { percentChange } from "@/server/money";
import { canSeeField, permissionList, visibleFields } from "@/server/permissions";
import { observeBusiness } from "@/server/brain";

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleString("en-IN", { month: "short", timeZone: "UTC" });
}

export function buildWorkspace(db: Database.Database, actor: Actor): Workspace {
  const user = db.prepare(`SELECT id, name, email FROM users WHERE id = ?`).get(actor.userId) as { id: string; name: string; email: string };
  const businesses = db
    .prepare(
      `SELECT b.* FROM businesses b
       JOIN business_members m ON m.business_id = b.id
       WHERE m.user_id = ? ORDER BY b.name`
    )
    .all(actor.userId) as Array<Record<string, unknown>>;
  const mapBusiness = (row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name),
    city: String(row.city),
    businessType: String(row.business_type),
    ecommerceBilling: row.ecommerce_billing === 1,
    currency: String(row.currency),
    timezone: String(row.timezone),
    gstin: (row.gstin as string | null) ?? null,
  });
  const business = businesses.find((row) => row.id === actor.businessId);
  if (!business) throw new Error("active business missing");

  const revenueRows = db
    .prepare(
      `SELECT substr(created_at, 1, 7) AS month,
              COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_paise ELSE -amount_paise END), 0) AS total
       FROM ledger_entries
       WHERE business_id = ? AND account = 'revenue'
       GROUP BY month ORDER BY month`
    )
    .all(actor.businessId) as Array<{ month: string; total: number }>;
  const expenseRows = db
    .prepare(
      `SELECT c.name AS category, COALESCE(SUM(e.amount_paise), 0) AS paise
       FROM expenses e JOIN expense_categories c ON c.id = e.category_id
       WHERE e.business_id = ? GROUP BY c.name ORDER BY paise DESC`
    )
    .all(actor.businessId) as Array<{ category: string; paise: number }>;
  const expensePaise = expenseRows.reduce((sum, row) => sum + row.paise, 0);
  const latest = revenueRows.at(-1)?.total ?? 0;
  const previous = revenueRows.at(-2)?.total ?? 0;
  const showFinancials = canSeeField(actor.role, "financial_reports");
  const showCost = canSeeField(actor.role, "purchase_cost");
  const showCustomerMoney = canSeeField(actor.role, "customer_financials");

  const products = db
    .prepare(
      `SELECT p.id, p.name, p.sku, p.purchase_cost_paise, v.id AS variant_id, v.selling_price_paise, v.unit,
              COALESCE(b.quantity_milli, 0) AS quantity_milli
       FROM products p
       JOIN product_variants v ON v.product_id = p.id
       LEFT JOIN stock_balances b ON b.variant_id = v.id
       WHERE p.business_id = ?`
    )
    .all(actor.businessId) as Array<Record<string, unknown>>;

  const customers = db.prepare(`SELECT id, name, phone, email, gstin, notes, created_at FROM customers WHERE business_id = ? AND archived_at IS NULL ORDER BY name`).all(actor.businessId);
  const insights = observeBusiness(db, actor).map(({ evidence: _evidence, ...insight }) => insight);

  return {
    user: { ...user, role: actor.role },
    businesses: businesses.map(mapBusiness),
    business: mapBusiness(business),
    permissions: permissionList(actor.role),
    fields: visibleFields(actor.role),
    overview: {
      revenuePaise: showFinancials ? latest : 0,
      previousRevenuePaise: showFinancials ? previous : 0,
      expensePaise: showFinancials ? expensePaise : 0,
      profitPaise: showFinancials ? latest - expensePaise : 0,
      profitComplete: false,
      newLeads: (db.prepare(`SELECT COUNT(*) AS total FROM leads WHERE business_id = ? AND stage = 'new'`).get(actor.businessId) as { total: number }).total,
      customers: (customers as unknown[]).length,
      bookReceivablePaise: showFinancials ? accountBalance(db, actor.businessId, "accounts_receivable").netDebitPaise : 0,
      months: showFinancials ? revenueRows.slice(-6).map((row) => ({ month: monthLabel(row.month), revenuePaise: row.total })) : [],
      expenses: showFinancials
        ? expenseRows.map((row) => ({ ...row, sharePct: expensePaise ? Math.round((row.paise / expensePaise) * 100) : 0 }))
        : [],
      schedule: db
        .prepare(`SELECT id, due_at, title, detail FROM tasks WHERE business_id = ? AND status = 'open' ORDER BY due_at LIMIT 4`)
        .all(actor.businessId)
        .map((task) => {
          const row = task as { id: string; due_at: string | null; title: string; detail: string };
          const time = row.due_at ? new Date(row.due_at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "Open";
          return { id: row.id, time, title: row.title, detail: row.detail };
        }),
      inventory: products.map((product) => ({
        id: String(product.variant_id),
        name: String(product.name),
        quantityMilli: Number(product.quantity_milli),
        low: Number(product.quantity_milli) <= 5000,
      })),
      insights,
    },
    leads: db.prepare(`SELECT * FROM leads WHERE business_id = ? ORDER BY updated_at DESC`).all(actor.businessId) as Array<Record<string, unknown>>,
    customers: customers as Array<Record<string, unknown>>,
    products: products.map((product) => {
      if (!showCost) {
        const { purchase_cost_paise: _hidden, ...rest } = product;
        return rest;
      }
      return product;
    }),
    orders: db.prepare(`SELECT * FROM ecommerce_orders WHERE business_id = ? ORDER BY created_at DESC`).all(actor.businessId) as Array<Record<string, unknown>>,
    invoices: db.prepare(`SELECT * FROM invoices WHERE business_id = ? ORDER BY issued_at DESC`).all(actor.businessId) as Array<Record<string, unknown>>,
    payments: showCustomerMoney
      ? (db.prepare(`SELECT * FROM payment_transactions WHERE business_id = ? ORDER BY created_at DESC`).all(actor.businessId) as Array<Record<string, unknown>>)
      : [],
    reconciliation: showFinancials ? reconciliationIssues(db, actor.businessId) : [],
    ledger: showFinancials
      ? (db.prepare(`SELECT * FROM ledger_entries WHERE business_id = ? ORDER BY created_at DESC LIMIT 80`).all(actor.businessId) as Array<Record<string, unknown>>)
      : [],
    expenses: showFinancials
      ? (db
          .prepare(
            `SELECT e.*, c.name AS category FROM expenses e JOIN expense_categories c ON c.id = e.category_id WHERE e.business_id = ? ORDER BY incurred_on DESC`
          )
          .all(actor.businessId) as Array<Record<string, unknown>>)
      : [],
    tasks: db.prepare(`SELECT * FROM tasks WHERE business_id = ? ORDER BY created_at DESC`).all(actor.businessId) as Array<Record<string, unknown>>,
    approvals: db.prepare(`SELECT * FROM approvals WHERE business_id = ? ORDER BY created_at DESC`).all(actor.businessId) as Array<Record<string, unknown>>,
    campaigns: db.prepare(`SELECT * FROM campaigns WHERE business_id = ? ORDER BY created_at DESC`).all(actor.businessId) as Array<Record<string, unknown>>,
    reviews: db.prepare(`SELECT * FROM reviews WHERE business_id = ? ORDER BY created_at DESC`).all(actor.businessId) as Array<Record<string, unknown>>,
    integrations: db.prepare(`SELECT id, provider, category, status, detail, created_at FROM integrations WHERE business_id = ?`).all(actor.businessId) as Array<Record<string, unknown>>,
    members: db
      .prepare(
        `SELECT m.id, m.role, u.name, u.email FROM business_members m JOIN users u ON u.id = m.user_id WHERE m.business_id = ?`
      )
      .all(actor.businessId) as Array<Record<string, unknown>>,
    audit: db.prepare(`SELECT id, action, entity_type, entity_id, created_at FROM audit_events WHERE business_id = ? ORDER BY created_at DESC LIMIT 40`).all(actor.businessId) as Array<Record<string, unknown>>,
    backups: db.prepare(`SELECT id, sha256, created_at FROM backup_snapshots WHERE business_id = ? ORDER BY created_at DESC`).all(actor.businessId) as Array<{
      id: string;
      sha256: string;
      created_at: string;
    }>,
    messages: db.prepare(`SELECT * FROM messages WHERE business_id = ? ORDER BY created_at DESC`).all(actor.businessId) as Array<Record<string, unknown>>,
  };
}

export function revenueChange(workspace: Workspace) {
  return percentChange(workspace.overview.revenuePaise, workspace.overview.previousRevenuePaise);
}
