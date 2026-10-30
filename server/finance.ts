import type Database from "better-sqlite3";
import { audit, businessRow } from "@/server/audit";
import type { Actor } from "@/server/db";
import { nowIso } from "@/server/db";
import { AppError } from "@/server/errors";
import { linePaise, taxPaise } from "@/server/money";
import { assertPermission } from "@/server/permissions";

const BOOKED = new Set(["recorded", "app_confirmed", "bank_settled"]);

const transitions: Record<string, string[]> = {
  initiated: ["pending", "failed", "app_confirmed"],
  pending: ["app_confirmed", "failed", "under_investigation", "bank_settled"],
  app_confirmed: ["bank_settled", "reversed", "under_investigation"],
  recorded: ["reversed"],
  bank_settled: ["reversed"],
  under_investigation: ["bank_settled", "failed", "reversed"],
  failed: [],
  reversed: [],
};

type AllocationInput = { invoiceId?: string | null; amountPaise: number };

export type PaymentInput = {
  customerId?: string | null;
  method: "cash" | "upi" | "card" | "bank" | "credit";
  status: string;
  amountPaise: number;
  currency?: string;
  reference?: string | null;
  provider?: string | null;
  settlementEvidence?: string | null;
  idempotencyKey?: string | null;
  allocations?: AllocationInput[];
};

function postPair(
  db: Database.Database,
  actor: Actor,
  sourceType: string,
  sourceId: string,
  currency: string,
  amountPaise: number,
  debitAccount: string,
  creditAccount: string,
  memo: string,
  customerId?: string | null,
  supplierId?: string | null
) {
  const insert = db.prepare(
    `INSERT INTO ledger_entries
      (id, business_id, account, direction, amount_paise, currency, customer_id, supplier_id, source_type, source_id, reversal_of, memo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
  );
  const at = nowIso();
  insert.run(crypto.randomUUID(), actor.businessId, debitAccount, "debit", amountPaise, currency, customerId ?? null, supplierId ?? null, sourceType, sourceId, memo, at);
  insert.run(crypto.randomUUID(), actor.businessId, creditAccount, "credit", amountPaise, currency, customerId ?? null, supplierId ?? null, sourceType, sourceId, memo, at);
}

function reverseSource(db: Database.Database, actor: Actor, sourceType: string, sourceId: string) {
  const rows = db
    .prepare(
      `SELECT * FROM ledger_entries WHERE business_id = ? AND source_type = ? AND source_id = ? AND reversal_of IS NULL
       AND id NOT IN (SELECT reversal_of FROM ledger_entries WHERE reversal_of IS NOT NULL)`
    )
    .all(actor.businessId, sourceType, sourceId) as Array<{
    id: string;
    account: string;
    direction: "debit" | "credit";
    amount_paise: number;
    currency: string;
    customer_id: string | null;
    supplier_id: string | null;
  }>;
  const insert = db.prepare(
    `INSERT INTO ledger_entries
      (id, business_id, account, direction, amount_paise, currency, customer_id, supplier_id, source_type, source_id, reversal_of, memo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const row of rows) {
    insert.run(
      crypto.randomUUID(),
      actor.businessId,
      row.account,
      row.direction === "debit" ? "credit" : "debit",
      row.amount_paise,
      row.currency,
      row.customer_id,
      row.supplier_id,
      sourceType,
      sourceId,
      row.id,
      "Reversal",
      nowIso()
    );
  }
}

function methodAccount(method: string) {
  if (method === "cash") return "cash";
  if (method === "upi") return "upi_clearing";
  if (method === "card") return "card_clearing";
  if (method === "bank") return "bank";
  return "customer_credit";
}

export function invoiceBalance(db: Database.Database, businessId: string, invoiceId: string) {
  const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ? AND business_id = ?`).get(invoiceId, businessId) as
    | { total_paise: number; status: string; currency: string }
    | undefined;
  if (!invoice) throw new AppError(404, "NOT_FOUND", "Invoice not found");
  const booked = db
    .prepare(
      `SELECT COALESCE(SUM(a.amount_paise), 0) AS total
       FROM payment_allocations a
       JOIN payment_transactions p ON p.id = a.payment_id
       WHERE a.invoice_id = ? AND a.business_id = ? AND p.status IN ('recorded','app_confirmed','bank_settled')`
    )
    .get(invoiceId, businessId) as { total: number };
  const settled = db
    .prepare(
      `SELECT COALESCE(SUM(a.amount_paise), 0) AS total
       FROM payment_allocations a
       JOIN payment_transactions p ON p.id = a.payment_id
       WHERE a.invoice_id = ? AND a.business_id = ? AND p.status = 'bank_settled'`
    )
    .get(invoiceId, businessId) as { total: number };
  const credited = db
    .prepare(`SELECT COALESCE(SUM(amount_paise), 0) AS total FROM credit_notes WHERE invoice_id = ? AND business_id = ?`)
    .get(invoiceId, businessId) as { total: number };
  return {
    currency: invoice.currency,
    totalPaise: invoice.total_paise,
    bookedPaise: booked.total,
    bankSettledPaise: settled.total,
    creditNotePaise: credited.total,
    bookDuePaise: invoice.status === "cancelled" ? 0 : invoice.total_paise - booked.total - credited.total,
    bankDuePaise: invoice.status === "cancelled" ? 0 : invoice.total_paise - settled.total - credited.total,
  };
}

function financialYear(monthStart: number, iso: string) {
  const date = new Date(iso);
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const startYear = month >= monthStart ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

export function issueInvoiceForOrder(db: Database.Database, actor: Actor, orderId: string) {
  assertPermission(actor, "invoice:create");
  const business = businessRow(db, actor.businessId);
  if (!business.ecommerce_billing) {
    throw new AppError(403, "BILLING_DISABLED", "Invoices are available only for e-commerce businesses");
  }
  const existing = db.prepare(`SELECT * FROM invoices WHERE order_id = ? AND business_id = ?`).get(orderId, actor.businessId);
  if (existing) return existing;

  const order = db.prepare(`SELECT * FROM ecommerce_orders WHERE id = ? AND business_id = ?`).get(orderId, actor.businessId) as
    | {
        id: string;
        customer_id: string | null;
        currency: string;
        discount_paise: number;
        shipping_paise: number;
        fulfillment_status: string;
      }
    | undefined;
  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found");
  if (order.fulfillment_status === "cancelled") {
    throw new AppError(409, "ORDER_CANCELLED", "A cancelled order cannot be invoiced");
  }

  const items = db.prepare(`SELECT * FROM ecommerce_order_items WHERE order_id = ? AND business_id = ?`).all(order.id, actor.businessId) as Array<{
    sku: string;
    name: string;
    quantity_milli: number;
    unit_paise: number;
  }>;
  if (items.length === 0) throw new AppError(422, "EMPTY_ORDER", "Order has no lines");

  const run = db.transaction(() => {
    const again = db.prepare(`SELECT * FROM invoices WHERE order_id = ?`).get(order.id);
    if (again) return again;
    const subtotal = items.reduce((sum, item) => sum + linePaise(item.quantity_milli, item.unit_paise), 0);
    const discounted = subtotal - order.discount_paise;
    if (discounted < 0) throw new AppError(422, "DISCOUNT_TOO_LARGE", "Discount exceeds the merchandise total");
    const tax = taxPaise(discounted, business.default_tax_bps);
    const total = discounted + tax + order.shipping_paise;
    const issuedAt = nowIso();
    const fy = financialYear(business.financial_year_start_month, issuedAt);
    db.prepare(
      `INSERT INTO invoice_sequences (business_id, financial_year, last_number) VALUES (?, ?, 0)
       ON CONFLICT(business_id, financial_year) DO NOTHING`
    ).run(actor.businessId, fy);
    const seq = db
      .prepare(`UPDATE invoice_sequences SET last_number = last_number + 1 WHERE business_id = ? AND financial_year = ? RETURNING last_number`)
      .get(actor.businessId, fy) as { last_number: number };
    const number = `INV-${fy}-${String(seq.last_number).padStart(4, "0")}`;
    const invoiceId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO invoices
        (id, business_id, order_id, customer_id, number, status, currency, subtotal_paise, discount_paise, shipping_paise, tax_paise, total_paise, issued_at)
       VALUES (?, ?, ?, ?, ?, 'issued', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      invoiceId,
      actor.businessId,
      order.id,
      order.customer_id,
      number,
      order.currency,
      subtotal,
      order.discount_paise,
      order.shipping_paise,
      tax,
      total,
      issuedAt
    );
    const insertItem = db.prepare(
      `INSERT INTO invoice_items (id, invoice_id, business_id, sku, name, quantity_milli, unit_paise, tax_bps, line_paise)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of items) {
      insertItem.run(
        crypto.randomUUID(),
        invoiceId,
        actor.businessId,
        item.sku,
        item.name,
        item.quantity_milli,
        item.unit_paise,
        business.default_tax_bps,
        linePaise(item.quantity_milli, item.unit_paise)
      );
    }
    postPair(db, actor, "invoice", invoiceId, order.currency, total, "accounts_receivable", "revenue", `Invoice ${number}`, order.customer_id);
    if (tax > 0) {
      postPair(db, actor, "invoice_tax", invoiceId, order.currency, tax, "revenue", "tax_payable", `Tax on ${number}`, order.customer_id);
    }
    audit(db, actor, "invoice.issued", "invoice", invoiceId, { number, totalPaise: total, orderId: order.id });
    return db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(invoiceId);
  });
  return run();
}

export function recordPayment(db: Database.Database, actor: Actor, input: PaymentInput) {
  assertPermission(actor, "payment:create");
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new AppError(422, "INVALID_AMOUNT", "Payment amount must be a positive number of paise");
  }
  if (input.method === "cash" && input.status !== "recorded") {
    throw new AppError(422, "CASH_STATE", "A cash receipt is a recorded book entry, not a bank settlement");
  }
  if (input.method !== "cash" && input.status === "recorded") {
    throw new AppError(422, "RECORDED_STATE", "Only cash can be stored as a recorded receipt");
  }
  if (input.status === "bank_settled" && (!input.reference || !input.settlementEvidence)) {
    throw new AppError(422, "SETTLEMENT_EVIDENCE", "Bank settled requires a reference and settlement evidence");
  }
  const business = businessRow(db, actor.businessId);
  const currency = input.currency ?? business.currency;
  if (currency !== business.currency && input.allocations?.some((row) => row.invoiceId)) {
    throw new AppError(422, "CURRENCY_MISMATCH", "An allocation must use the invoice currency");
  }

  const run = db.transaction(() => {
    if (input.idempotencyKey) {
      const prior = db
        .prepare(`SELECT * FROM payment_transactions WHERE business_id = ? AND idempotency_key = ?`)
        .get(actor.businessId, input.idempotencyKey);
      if (prior) return prior;
    }
    const paymentId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO payment_transactions
        (id, business_id, customer_id, method, status, amount_paise, currency, reference, provider, settlement_evidence, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      paymentId,
      actor.businessId,
      input.customerId ?? null,
      input.method,
      input.status,
      input.amountPaise,
      currency,
      input.reference ?? null,
      input.provider ?? null,
      input.settlementEvidence ?? null,
      input.idempotencyKey ?? null,
      nowIso()
    );
    let allocated = 0;
    for (const allocation of input.allocations ?? []) {
      if (!Number.isInteger(allocation.amountPaise) || allocation.amountPaise <= 0) {
        throw new AppError(422, "INVALID_ALLOCATION", "Allocation must be a positive number of paise");
      }
      allocated += allocation.amountPaise;
      if (allocation.invoiceId) {
        const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(allocation.invoiceId) as
          | { id: string; business_id: string; currency: string; status: string; total_paise: number }
          | undefined;
        if (!invoice || invoice.business_id !== actor.businessId) {
          throw new AppError(404, "NOT_FOUND", "Invoice not found");
        }
        if (invoice.currency !== currency) throw new AppError(422, "CURRENCY_MISMATCH", "Payment currency differs from the invoice");
        if (invoice.status !== "issued") throw new AppError(409, "INVOICE_CLOSED", "Cannot allocate to a cancelled invoice");
        const balance = invoiceBalance(db, actor.businessId, invoice.id);
        if (allocation.amountPaise > balance.bookDuePaise) {
          throw new AppError(409, "OVER_ALLOCATION", "Allocation exceeds the invoice book balance");
        }
      }
      db.prepare(
        `INSERT INTO payment_allocations (id, business_id, payment_id, invoice_id, amount_paise, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(crypto.randomUUID(), actor.businessId, paymentId, allocation.invoiceId ?? null, allocation.amountPaise, nowIso());
    }
    if (allocated > input.amountPaise) {
      throw new AppError(409, "OVER_ALLOCATION", "Allocations exceed the payment amount");
    }
    if (BOOKED.has(input.status)) {
      postPair(
        db,
        actor,
        "payment",
        paymentId,
        currency,
        input.amountPaise,
        methodAccount(input.method),
        "accounts_receivable",
        `${input.method} receipt`,
        input.customerId
      );
    }
    audit(db, actor, "payment.recorded", "payment", paymentId, {
      method: input.method,
      status: input.status,
      amountPaise: input.amountPaise,
      currency,
    });
    return db.prepare(`SELECT * FROM payment_transactions WHERE id = ?`).get(paymentId);
  });
  return run();
}

export function transitionPayment(
  db: Database.Database,
  actor: Actor,
  paymentId: string,
  nextStatus: string,
  evidence?: { reference?: string; settlementEvidence?: string }
) {
  assertPermission(actor, "payment:approve");
  const run = db.transaction(() => {
    const payment = db.prepare(`SELECT * FROM payment_transactions WHERE id = ?`).get(paymentId) as
      | {
          id: string;
          business_id: string;
          status: string;
          method: string;
          amount_paise: number;
          currency: string;
          customer_id: string | null;
          reference: string | null;
        }
      | undefined;
    if (!payment || payment.business_id !== actor.businessId) throw new AppError(404, "NOT_FOUND", "Payment not found");
    if (!transitions[payment.status]?.includes(nextStatus)) {
      throw new AppError(409, "INVALID_TRANSITION", `Cannot move a payment from ${payment.status} to ${nextStatus}`);
    }
    if (nextStatus === "bank_settled") {
      const reference = evidence?.reference || payment.reference;
      if (!reference || !evidence?.settlementEvidence) {
        throw new AppError(422, "SETTLEMENT_EVIDENCE", "Bank settled requires a reference and settlement evidence");
      }
      db.prepare(`UPDATE payment_transactions SET status = ?, reference = ?, settlement_evidence = ? WHERE id = ?`).run(
        nextStatus,
        reference,
        evidence.settlementEvidence,
        payment.id
      );
    } else {
      db.prepare(`UPDATE payment_transactions SET status = ? WHERE id = ?`).run(nextStatus, payment.id);
    }
    const wasBooked = BOOKED.has(payment.status);
    const nowBooked = BOOKED.has(nextStatus);
    if (!wasBooked && nowBooked) {
      postPair(db, actor, "payment", payment.id, payment.currency, payment.amount_paise, methodAccount(payment.method), "accounts_receivable", "Payment booked", payment.customer_id);
    }
    if (wasBooked && nextStatus === "reversed") {
      reverseSource(db, actor, "payment", payment.id);
    }
    audit(db, actor, "payment.transition", "payment", payment.id, { from: payment.status, to: nextStatus });
    return db.prepare(`SELECT * FROM payment_transactions WHERE id = ?`).get(payment.id);
  });
  return run();
}

export function createRefund(db: Database.Database, actor: Actor, input: { paymentId: string; amountPaise: number; reference?: string }) {
  assertPermission(actor, "refund:approve");
  const run = db.transaction(() => {
    const payment = db.prepare(`SELECT * FROM payment_transactions WHERE id = ?`).get(input.paymentId) as
      | { id: string; business_id: string; status: string; amount_paise: number; currency: string; customer_id: string | null; method: string }
      | undefined;
    if (!payment || payment.business_id !== actor.businessId) throw new AppError(404, "NOT_FOUND", "Payment not found");
    if (!BOOKED.has(payment.status)) throw new AppError(409, "NOT_REFUNDABLE", "Only a booked payment can be refunded");
    const already = db.prepare(`SELECT COALESCE(SUM(amount_paise), 0) AS total FROM refunds WHERE payment_id = ? AND status = 'refund_completed'`).get(payment.id) as { total: number };
    if (input.amountPaise > payment.amount_paise - already.total) {
      throw new AppError(409, "OVER_REFUND", "Refund exceeds the remaining payment");
    }
    const refundId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO refunds (id, business_id, payment_id, amount_paise, status, reference, created_at) VALUES (?, ?, ?, ?, 'refund_completed', ?, ?)`
    ).run(refundId, actor.businessId, payment.id, input.amountPaise, input.reference ?? null, nowIso());
    postPair(db, actor, "refund", refundId, payment.currency, input.amountPaise, "accounts_receivable", methodAccount(payment.method), "Refund", payment.customer_id);
    audit(db, actor, "refund.completed", "refund", refundId, { paymentId: payment.id, amountPaise: input.amountPaise });
    return db.prepare(`SELECT * FROM refunds WHERE id = ?`).get(refundId);
  });
  return run();
}

export function issueCreditNote(db: Database.Database, actor: Actor, input: { invoiceId: string; amountPaise: number; reason: string }) {
  assertPermission(actor, "invoice:approve");
  const business = businessRow(db, actor.businessId);
  if (!business.ecommerce_billing) throw new AppError(403, "BILLING_DISABLED", "Credit notes belong to e-commerce billing");
  const run = db.transaction(() => {
    const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(input.invoiceId) as
      | { id: string; business_id: string; number: string; currency: string; customer_id: string | null; total_paise: number; status: string }
      | undefined;
    if (!invoice || invoice.business_id !== actor.businessId) throw new AppError(404, "NOT_FOUND", "Invoice not found");
    const existing = db.prepare(`SELECT COALESCE(SUM(amount_paise), 0) AS total FROM credit_notes WHERE invoice_id = ?`).get(invoice.id) as { total: number };
    if (input.amountPaise > invoice.total_paise - existing.total) {
      throw new AppError(409, "OVER_CREDIT", "Credit note exceeds the invoice");
    }
    const count = db.prepare(`SELECT COUNT(*) AS total FROM credit_notes WHERE business_id = ?`).get(actor.businessId) as { total: number };
    const number = `CN-${invoice.number}-${count.total + 1}`;
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO credit_notes (id, business_id, invoice_id, number, amount_paise, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, actor.businessId, invoice.id, number, input.amountPaise, input.reason, nowIso());
    postPair(db, actor, "credit_note", id, invoice.currency, input.amountPaise, "revenue", "accounts_receivable", number, invoice.customer_id);
    audit(db, actor, "credit_note.issued", "credit_note", id, { invoiceId: invoice.id, amountPaise: input.amountPaise });
    return db.prepare(`SELECT * FROM credit_notes WHERE id = ?`).get(id);
  });
  return run();
}

export function postOpeningReceivable(db: Database.Database, actor: Actor, customerId: string, amountPaise: number) {
  assertPermission(actor, "ledger:create");
  const customer = db.prepare(`SELECT id, business_id FROM customers WHERE id = ?`).get(customerId) as
    | { id: string; business_id: string }
    | undefined;
  if (!customer || customer.business_id !== actor.businessId) throw new AppError(404, "NOT_FOUND", "Customer not found");
  const business = businessRow(db, actor.businessId);
  const id = crypto.randomUUID();
  postPair(db, actor, "opening", id, business.currency, amountPaise, "accounts_receivable", "opening_balance", "Opening balance", customerId);
  audit(db, actor, "ledger.opening", "ledger", id, { customerId, amountPaise });
  return { id, amountPaise };
}

export function recordExpense(
  db: Database.Database,
  actor: Actor,
  input: { categoryName: string; amountPaise: number; memo?: string; incurredOn: string; supplierId?: string | null }
) {
  assertPermission(actor, "expense:create");
  const business = businessRow(db, actor.businessId);
  const run = db.transaction(() => {
    let category = db
      .prepare(`SELECT * FROM expense_categories WHERE business_id = ? AND name = ?`)
      .get(actor.businessId, input.categoryName) as { id: string } | undefined;
    if (!category) {
      const id = crypto.randomUUID();
      db.prepare(`INSERT INTO expense_categories (id, business_id, name) VALUES (?, ?, ?)`).run(id, actor.businessId, input.categoryName);
      category = { id };
    }
    const expenseId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO expenses (id, business_id, category_id, supplier_id, amount_paise, currency, memo, incurred_on, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      expenseId,
      actor.businessId,
      category.id,
      input.supplierId ?? null,
      input.amountPaise,
      business.currency,
      input.memo ?? "",
      input.incurredOn,
      nowIso()
    );
    postPair(db, actor, "expense", expenseId, business.currency, input.amountPaise, "expense", "cash", input.memo ?? input.categoryName, null, input.supplierId);
    audit(db, actor, "expense.recorded", "expense", expenseId, { amountPaise: input.amountPaise, category: input.categoryName });
    return db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(expenseId);
  });
  return run();
}

export function accountBalance(db: Database.Database, businessId: string, account: string) {
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_paise ELSE 0 END), 0) AS debit,
         COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_paise ELSE 0 END), 0) AS credit
       FROM ledger_entries WHERE business_id = ? AND account = ?`
    )
    .get(businessId, account) as { debit: number; credit: number };
  return { debitPaise: row.debit, creditPaise: row.credit, netDebitPaise: row.debit - row.credit };
}

export function reconciliationIssues(db: Database.Database, businessId: string) {
  const issues: Array<{ code: string; message: string; entityId: string }> = [];
  const invoices = db.prepare(`SELECT id, number, total_paise FROM invoices WHERE business_id = ? AND status = 'issued'`).all(businessId) as Array<{
    id: string;
    number: string;
    total_paise: number;
  }>;
  for (const invoice of invoices) {
    const balance = invoiceBalance(db, businessId, invoice.id);
    if (balance.bookDuePaise < 0) {
      issues.push({ code: "over_allocated", message: `${invoice.number} is allocated above its total`, entityId: invoice.id });
    }
    const receivable = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_paise ELSE -amount_paise END), 0) AS net
         FROM ledger_entries
         WHERE business_id = ? AND account = 'accounts_receivable' AND source_id = ? AND source_type IN ('invoice','invoice_tax')`
      )
      .get(businessId, invoice.id) as { net: number };
    if (receivable.net !== invoice.total_paise) {
      issues.push({
        code: "ledger_mismatch",
        message: `${invoice.number} receivable posting does not match the invoice total`,
        entityId: invoice.id,
      });
    }
  }
  const pending = db
    .prepare(`SELECT id, reference, amount_paise FROM payment_transactions WHERE business_id = ? AND status IN ('pending','under_investigation','initiated')`)
    .all(businessId) as Array<{ id: string; reference: string | null; amount_paise: number }>;
  for (const payment of pending) {
    issues.push({
      code: "unsettled_payment",
      message: `Payment of ${payment.amount_paise} paise is not bank settled`,
      entityId: payment.id,
    });
  }
  const dupes = db
    .prepare(
      `SELECT reference, provider, COUNT(*) AS total FROM payment_transactions
       WHERE business_id = ? AND reference IS NOT NULL AND provider IS NOT NULL
       GROUP BY reference, provider HAVING total > 1`
    )
    .all(businessId) as Array<{ reference: string; provider: string }>;
  for (const row of dupes) {
    issues.push({ code: "duplicate_reference", message: `Duplicate ${row.provider} reference ${row.reference}`, entityId: row.reference });
  }
  return issues;
}

export function customerBookBalance(db: Database.Database, businessId: string, customerId: string) {
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_paise ELSE -amount_paise END), 0) AS net
       FROM ledger_entries
       WHERE business_id = ? AND customer_id = ? AND account = 'accounts_receivable'`
    )
    .get(businessId, customerId) as { net: number };
  return row.net;
}
