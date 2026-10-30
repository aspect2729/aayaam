import type Database from "better-sqlite3";
import { audit, businessRow } from "@/server/audit";
import type { Actor } from "@/server/db";
import { nowIso } from "@/server/db";
import { AppError } from "@/server/errors";
import { customerBookBalance } from "@/server/finance";
import { issueInvoiceForOrder } from "@/server/finance";
import { decimalToMilli, decimalToPaise, formatInr } from "@/server/money";
import { assertPermission } from "@/server/permissions";

export function createCustomer(
  db: Database.Database,
  actor: Actor,
  input: { name: string; phone?: string | null; email?: string | null; gstin?: string | null; notes?: string }
) {
  assertPermission(actor, "customer:create");
  const phone = input.phone?.trim() || null;
  if (phone) {
    const existing = db
      .prepare(`SELECT id, name FROM customers WHERE business_id = ? AND phone = ? AND archived_at IS NULL`)
      .get(actor.businessId, phone) as { id: string; name: string } | undefined;
    if (existing) {
      throw new AppError(409, "DUPLICATE_CUSTOMER", `Phone already belongs to ${existing.name}`, );
    }
  }
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO customers (id, business_id, name, phone, email, gstin, notes, archived_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`
  ).run(id, actor.businessId, input.name.trim(), phone, input.email ?? null, input.gstin ?? null, input.notes ?? "", nowIso());
  audit(db, actor, "customer.created", "customer", id, { name: input.name, phone });
  return db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
}

export function updateCustomer(
  db: Database.Database,
  actor: Actor,
  customerId: string,
  input: { name?: string; phone?: string | null; email?: string | null; notes?: string }
) {
  assertPermission(actor, "customer:edit");
  const current = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(customerId) as { id: string; business_id: string } | undefined;
  if (!current || current.business_id !== actor.businessId) throw new AppError(404, "NOT_FOUND", "Customer not found");
  if (input.phone) {
    const clash = db
      .prepare(`SELECT id, name FROM customers WHERE business_id = ? AND phone = ? AND archived_at IS NULL AND id != ?`)
      .get(actor.businessId, input.phone, customerId) as { name: string } | undefined;
    if (clash) throw new AppError(409, "DUPLICATE_CUSTOMER", `Phone already belongs to ${clash.name}`);
  }
  db.prepare(
    `UPDATE customers SET
       name = COALESCE(?, name),
       phone = CASE WHEN ? THEN NULL ELSE COALESCE(?, phone) END,
       email = COALESCE(?, email),
       notes = COALESCE(?, notes)
     WHERE id = ?`
  ).run(
    input.name ?? null,
    input.phone === null ? 1 : 0,
    input.phone === undefined ? null : input.phone,
    input.email ?? null,
    input.notes ?? null,
    customerId
  );
  audit(db, actor, "customer.updated", "customer", customerId, input);
  return db.prepare(`SELECT * FROM customers WHERE id = ?`).get(customerId);
}

function runLeadWorkflow(db: Database.Database, actor: Actor, leadId: string, stage: string) {
  if (stage !== "qualified" && stage !== "new") return;
  const rules = db
    .prepare(`SELECT * FROM workflow_rules WHERE business_id = ? AND trigger = 'lead.created' AND enabled = 1`)
    .all(actor.businessId) as Array<{ id: string; action: string }>;
  for (const rule of rules) {
    if (rule.action === "create_followup_task") {
      const taskId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO tasks (id, business_id, title, detail, status, due_at, assignee_member_id, source_type, source_id, created_at)
         VALUES (?, ?, 'Follow up new lead', 'Contact this lead and record the outcome.', 'open', ?, NULL, 'lead', ?, ?)`
      ).run(taskId, actor.businessId, new Date(Date.now() + 86400000).toISOString(), leadId, nowIso());
      db.prepare(
        `INSERT INTO workflow_runs (id, business_id, rule_id, status, detail, created_at) VALUES (?, ?, ?, 'succeeded', ?, ?)`
      ).run(crypto.randomUUID(), actor.businessId, rule.id, taskId, nowIso());
    }
  }
}

export function createLead(
  db: Database.Database,
  actor: Actor,
  input: { name: string; phone?: string | null; email?: string | null; source: string; requirement?: string; budgetPaise?: number | null; stage?: string }
) {
  assertPermission(actor, "lead:create");
  const phone = input.phone?.trim() || null;
  if (phone) {
    const existing = db
      .prepare(`SELECT id, name, stage FROM leads WHERE business_id = ? AND phone = ? AND stage NOT IN ('won','lost')`)
      .get(actor.businessId, phone) as { id: string; name: string } | undefined;
    if (existing) {
      throw new AppError(409, "DUPLICATE_LEAD", `An open lead already exists for this phone (${existing.name})`);
    }
  }
  const stage = input.stage ?? "new";
  const id = crypto.randomUUID();
  const at = nowIso();
  db.prepare(
    `INSERT INTO leads (id, business_id, customer_id, name, phone, email, source, stage, score, requirement, budget_paise, assignee_member_id, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 0, ?, ?, NULL, ?, ?)`
  ).run(id, actor.businessId, input.name.trim(), phone, input.email ?? null, input.source, stage, input.requirement ?? "", input.budgetPaise ?? null, at, at);
  db.prepare(`INSERT INTO lead_activities (id, business_id, lead_id, kind, body, created_at) VALUES (?, ?, ?, 'created', ?, ?)`).run(
    crypto.randomUUID(),
    actor.businessId,
    id,
    "Lead captured",
    at
  );
  runLeadWorkflow(db, actor, id, stage);
  audit(db, actor, "lead.created", "lead", id, { name: input.name, phone, source: input.source });
  return db.prepare(`SELECT * FROM leads WHERE id = ?`).get(id);
}

export function updateLeadStage(db: Database.Database, actor: Actor, leadId: string, stage: string) {
  assertPermission(actor, "lead:edit");
  const lead = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(leadId) as { id: string; business_id: string } | undefined;
  if (!lead || lead.business_id !== actor.businessId) throw new AppError(404, "NOT_FOUND", "Lead not found");
  db.prepare(`UPDATE leads SET stage = ?, updated_at = ? WHERE id = ?`).run(stage, nowIso(), leadId);
  db.prepare(`INSERT INTO lead_activities (id, business_id, lead_id, kind, body, created_at) VALUES (?, ?, ?, 'stage', ?, ?)`).run(
    crypto.randomUUID(),
    actor.businessId,
    leadId,
    `Stage set to ${stage}`,
    nowIso()
  );
  audit(db, actor, "lead.stage", "lead", leadId, { stage });
  return db.prepare(`SELECT * FROM leads WHERE id = ?`).get(leadId);
}

export function ensureLocation(db: Database.Database, businessId: string) {
  const existing = db.prepare(`SELECT * FROM inventory_locations WHERE business_id = ? LIMIT 1`).get(businessId) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO inventory_locations (id, business_id, name) VALUES (?, ?, 'Primary')`).run(id, businessId, );
  return id;
}

export function createProduct(
  db: Database.Database,
  actor: Actor,
  input: { name: string; sku: string; sellingPricePaise: number; purchaseCostPaise?: number | null; unit?: string }
) {
  assertPermission(actor, "product:create");
  const run = db.transaction(() => {
    const productId = crypto.randomUUID();
    const variantId = crypto.randomUUID();
    const at = nowIso();
    db.prepare(
      `INSERT INTO products (id, business_id, name, sku, purchase_cost_paise, currency, active, created_at) VALUES (?, ?, ?, ?, ?, 'INR', 1, ?)`
    ).run(productId, actor.businessId, input.name, input.sku, input.purchaseCostPaise ?? null, at);
    db.prepare(
      `INSERT INTO product_variants (id, business_id, product_id, name, sku, selling_price_paise, unit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(variantId, actor.businessId, productId, input.name, input.sku, input.sellingPricePaise, input.unit ?? "piece", at);
    const locationId = ensureLocation(db, actor.businessId);
    db.prepare(`INSERT INTO stock_balances (business_id, variant_id, location_id, quantity_milli) VALUES (?, ?, ?, 0)`).run(
      actor.businessId,
      variantId,
      locationId
    );
    audit(db, actor, "product.created", "product", productId, { sku: input.sku });
    return { productId, variantId };
  });
  return run();
}

export function moveStock(
  db: Database.Database,
  actor: Actor,
  input: { variantId: string; quantityMilli: number; reason: string; sourceType: string; sourceId: string }
) {
  assertPermission(actor, "stock:create");
  const variant = db.prepare(`SELECT * FROM product_variants WHERE id = ?`).get(input.variantId) as { id: string; business_id: string } | undefined;
  if (!variant || variant.business_id !== actor.businessId) throw new AppError(404, "NOT_FOUND", "Variant not found");
  const locationId = ensureLocation(db, actor.businessId);
  const run = db.transaction(() => {
    const prior = db
      .prepare(`SELECT id FROM stock_movements WHERE business_id = ? AND source_type = ? AND source_id = ? AND variant_id = ? AND reason = ?`)
      .get(actor.businessId, input.sourceType, input.sourceId, input.variantId, input.reason) as { id: string } | undefined;
    if (prior) return prior;
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO stock_movements (id, business_id, variant_id, location_id, quantity_milli, reason, source_type, source_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, actor.businessId, input.variantId, locationId, input.quantityMilli, input.reason, input.sourceType, input.sourceId, nowIso());
    db.prepare(
      `INSERT INTO stock_balances (business_id, variant_id, location_id, quantity_milli) VALUES (?, ?, ?, ?)
       ON CONFLICT(variant_id, location_id) DO UPDATE SET quantity_milli = quantity_milli + excluded.quantity_milli`
    ).run(actor.businessId, input.variantId, locationId, input.quantityMilli);
    const balance = db.prepare(`SELECT quantity_milli FROM stock_balances WHERE variant_id = ? AND location_id = ?`).get(input.variantId, locationId) as {
      quantity_milli: number;
    };
    if (balance.quantity_milli < 0) throw new AppError(409, "NEGATIVE_STOCK", "This movement would make stock negative");
    audit(db, actor, "stock.moved", "stock_movement", id, input);
    return { id };
  });
  return run();
}

export type NormalizedOrder = {
  externalId: string;
  storeId: string;
  customerName: string;
  phone?: string | null;
  email?: string | null;
  currency: string;
  discountPaise: number;
  shippingPaise: number;
  fulfillmentStatus: "unfulfilled" | "fulfilled" | "cancelled" | "returned";
  financialStatus: string;
  lines: Array<{ sku: string; name: string; quantityMilli: number; unitPaise: number; variantId?: string | null }>;
};

export function ingestOrder(db: Database.Database, actor: Actor, order: NormalizedOrder) {
  assertPermission(actor, "order:create");
  const business = businessRow(db, actor.businessId);
  if (!business.ecommerce_billing) {
    throw new AppError(403, "BILLING_DISABLED", "Store orders are stored for e-commerce businesses only");
  }
  const run = db.transaction(() => {
    const existing = db
      .prepare(`SELECT * FROM ecommerce_orders WHERE store_id = ? AND external_id = ?`)
      .get(order.storeId, order.externalId) as { id: string; business_id: string } | undefined;
    if (existing) {
      if (existing.business_id !== actor.businessId) throw new AppError(403, "FORBIDDEN", "Order belongs to another business");
      return { orderId: existing.id, duplicate: true };
    }
    let customerId: string | null = null;
    if (order.phone) {
      const customer = db
        .prepare(`SELECT id FROM customers WHERE business_id = ? AND phone = ? AND archived_at IS NULL`)
        .get(actor.businessId, order.phone) as { id: string } | undefined;
      customerId = customer?.id ?? null;
    }
    if (!customerId) {
      customerId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO customers (id, business_id, name, phone, email, gstin, notes, archived_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, '', NULL, ?)`
      ).run(customerId, actor.businessId, order.customerName, order.phone ?? null, order.email ?? null, nowIso());
    }
    const orderId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO ecommerce_orders
        (id, business_id, store_id, external_id, customer_id, currency, fulfillment_status, financial_status, discount_paise, shipping_paise, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderId,
      actor.businessId,
      order.storeId,
      order.externalId,
      customerId,
      order.currency,
      order.fulfillmentStatus,
      order.financialStatus,
      order.discountPaise,
      order.shippingPaise,
      nowIso()
    );
    const insertItem = db.prepare(
      `INSERT INTO ecommerce_order_items (id, business_id, order_id, variant_id, sku, name, quantity_milli, unit_paise) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const line of order.lines) {
      const variant = (line.variantId
        ? db.prepare(`SELECT id, business_id FROM product_variants WHERE id = ?`).get(line.variantId)
        : db.prepare(`SELECT id, business_id FROM product_variants WHERE business_id = ? AND sku = ?`).get(actor.businessId, line.sku)) as
        | { id: string; business_id: string }
        | undefined;
      if (variant && variant.business_id !== actor.businessId) throw new AppError(403, "FORBIDDEN", "Variant belongs to another business");
      insertItem.run(crypto.randomUUID(), actor.businessId, orderId, variant?.id ?? null, line.sku, line.name, line.quantityMilli, line.unitPaise);
      if (order.fulfillmentStatus === "fulfilled" && variant) {
        moveStock(db, actor, {
          variantId: variant.id,
          quantityMilli: -line.quantityMilli,
          reason: "sale",
          sourceType: "order",
          sourceId: orderId,
        });
      }
    }
    let invoiceId: string | null = null;
    if (business.invoice_on_paid_order && order.financialStatus === "paid") {
      const invoice = issueInvoiceForOrder(db, actor, orderId) as { id: string };
      invoiceId = invoice.id;
    }
    audit(db, actor, "order.ingested", "order", orderId, { externalId: order.externalId, duplicate: false });
    return { orderId, duplicate: false, invoiceId };
  });
  return run();
}

export function parseShopifyOrder(payload: {
  id: number | string;
  currency?: string;
  financial_status?: string;
  fulfillment_status?: string | null;
  total_discounts?: string;
  total_shipping_price_set?: { shop_money?: { amount?: string } };
  customer?: { first_name?: string; last_name?: string; phone?: string; email?: string };
  line_items?: Array<{ sku?: string; title?: string; quantity?: number; price?: string }>;
}): NormalizedOrder {
  return {
    externalId: String(payload.id),
    storeId: "",
    customerName: `${payload.customer?.first_name ?? ""} ${payload.customer?.last_name ?? ""}`.trim() || "Shopify customer",
    phone: payload.customer?.phone ?? null,
    email: payload.customer?.email ?? null,
    currency: payload.currency || "INR",
    discountPaise: decimalToPaise(payload.total_discounts || "0"),
    shippingPaise: decimalToPaise(payload.total_shipping_price_set?.shop_money?.amount || "0"),
    fulfillmentStatus: payload.fulfillment_status === "fulfilled" ? "fulfilled" : payload.fulfillment_status === "restocked" ? "returned" : "unfulfilled",
    financialStatus: payload.financial_status || "pending",
    lines: (payload.line_items ?? []).map((line) => ({
      sku: line.sku || "unsku",
      name: line.title || "Item",
      quantityMilli: decimalToMilli(String(line.quantity ?? 0)),
      unitPaise: decimalToPaise(line.price || "0"),
    })),
  };
}

export function draftReminder(db: Database.Database, actor: Actor, customerId: string, channel: "whatsapp" | "email") {
  assertPermission(actor, "message:create");
  const customer = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(customerId) as
    | { id: string; business_id: string; name: string }
    | undefined;
  if (!customer || customer.business_id !== actor.businessId) throw new AppError(404, "NOT_FOUND", "Customer not found");
  const pending = db
    .prepare(
      `SELECT COUNT(*) AS total FROM payment_transactions WHERE business_id = ? AND customer_id = ? AND status IN ('pending','initiated','under_investigation','app_confirmed')`
    )
    .get(actor.businessId, customerId) as { total: number };
  const outstanding = customerBookBalance(db, actor.businessId, customerId);
  const blocked = pending.total > 0;
  const reason = blocked ? "A payment is still pending, app-confirmed, or under investigation. The due amount is not stable enough to send." : null;
  const body = blocked
    ? ""
    : `Hello ${customer.name}, our books show an outstanding balance of ${formatInr(outstanding)}. Reply if you have already paid.`;
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO messages (id, business_id, customer_id, channel, body, outstanding_paise, status, blocked_reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, actor.businessId, customerId, channel, body, outstanding, blocked ? "blocked" : "draft", reason, nowIso());
  audit(db, actor, blocked ? "message.blocked" : "message.drafted", "message", id, { customerId, outstanding, channel });
  return db.prepare(`SELECT * FROM messages WHERE id = ?`).get(id);
}

export function createTask(db: Database.Database, actor: Actor, input: { title: string; detail?: string; dueAt?: string | null }) {
  assertPermission(actor, "task:create");
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO tasks (id, business_id, title, detail, status, due_at, assignee_member_id, source_type, source_id, created_at)
     VALUES (?, ?, ?, ?, 'open', ?, NULL, 'manual', ?, ?)`
  ).run(id, actor.businessId, input.title, input.detail ?? "", input.dueAt ?? null, id, nowIso());
  audit(db, actor, "task.created", "task", id, { title: input.title });
  return db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
}

export function importCustomers(db: Database.Database, actor: Actor, csv: string) {
  assertPermission(actor, "customer:create");
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const [header, ...rows] = lines;
  if (!header) throw new AppError(422, "EMPTY_IMPORT", "The file is empty");
  const columns = header.split(",").map((column) => column.trim().toLowerCase());
  const nameIndex = columns.indexOf("name");
  const phoneIndex = columns.indexOf("phone");
  if (nameIndex < 0) throw new AppError(422, "MISSING_COLUMN", "A name column is required");
  const report = { created: [] as string[], duplicates: [] as string[], invalid: [] as string[] };
  for (const row of rows) {
    const cells = row.split(",").map((cell) => cell.trim());
    const name = cells[nameIndex] ?? "";
    const phone = phoneIndex >= 0 ? cells[phoneIndex] || null : null;
    if (!name) {
      report.invalid.push(row);
      continue;
    }
    try {
      const created = createCustomer(db, actor, { name, phone }) as { id: string };
      report.created.push(created.id);
    } catch (error) {
      if (error instanceof AppError && error.code === "DUPLICATE_CUSTOMER") report.duplicates.push(`${name} ${phone ?? ""}`.trim());
      else report.invalid.push(row);
    }
  }
  audit(db, actor, "customers.imported", "customer", actor.businessId, report);
  return report;
}
