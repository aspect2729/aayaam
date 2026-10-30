import { describe, expect, it } from "vitest";
import { registerAccount } from "@/server/auth";
import { exportBusiness, restoreSnapshot } from "@/server/backup";
import { runBrain } from "@/server/brain";
import { openDatabase, type Actor } from "@/server/db";
import { dispatchAction } from "@/server/dispatch";
import { AppError } from "@/server/errors";
import { invoiceBalance, recordPayment } from "@/server/finance";
import { acceptWebhook, hmacBase64, processQueuedJobs } from "@/server/integrations";
import { decimalToPaise, formatInr, linePaise, taxPaise } from "@/server/money";
import { assertPermission } from "@/server/permissions";
import { createCustomer, createLead, createProduct, draftReminder, ingestOrder, moveStock } from "@/server/records";
import { buildWorkspace } from "@/server/workspace";

function actorFor(db: ReturnType<typeof openDatabase>, userId: string, businessId: string, role: Actor["role"] = "owner"): Actor {
  const row = db.prepare(`SELECT organization_id FROM businesses WHERE id = ?`).get(businessId) as { organization_id: string };
  return { userId, businessId, organizationId: row.organization_id, role };
}

function setup() {
  const db = openDatabase(":memory:");
  const owner = registerAccount(db, {
    name: "Rohan",
    email: "owner@example.com",
    password: "password1234",
    businessName: "Mitti",
    city: "Mysuru",
    businessType: "handicraft",
    ecommerceBilling: true,
    gstin: "29ABCDE1234F1Z5",
  });
  const other = registerAccount(db, {
    name: "Other",
    email: "other@example.com",
    password: "password1234",
    businessName: "Other",
    city: "Pune",
    businessType: "gym",
    ecommerceBilling: false,
  });
  return {
    db,
    owner: actorFor(db, owner.userId, owner.businessId),
    other: actorFor(db, other.userId, other.businessId),
  };
}

describe("money", () => {
  it("keeps paise exact and formats Indian grouping", () => {
    expect(decimalToPaise("2840.00")).toBe(284000);
    expect(taxPaise(240000, 1800)).toBe(43200);
    expect(linePaise(1500, 10000)).toBe(15000);
    expect(formatInr(284000)).toBe("₹2,840.00");
    expect(() => decimalToPaise("1.999")).toThrow();
  });
});

describe("tenancy and permissions", () => {
  it("does not let one business edit another customer's phone", () => {
    const { db, owner, other } = setup();
    const customer = createCustomer(db, owner, { name: "Ananya", phone: "9845011111" }) as { id: string };
    expect(() => dispatchAction(db, other, "customer.update", { id: customer.id, name: "Stolen" })).toThrow(AppError);
    const still = db.prepare(`SELECT name FROM customers WHERE id = ?`).get(customer.id) as { name: string };
    expect(still.name).toBe("Ananya");
  });

  it("hides purchase cost from a salesperson", () => {
    const { db, owner } = setup();
    db.prepare(`UPDATE business_members SET role = 'salesperson' WHERE user_id = ?`).run(owner.userId);
    const salesperson = { ...owner, role: "salesperson" as const };
    createProduct(db, owner, { name: "Lamp", sku: "L1", sellingPricePaise: 10000, purchaseCostPaise: 4000 });
    const workspace = buildWorkspace(db, salesperson);
    expect(workspace.products[0]).not.toHaveProperty("purchase_cost_paise");
    expect(workspace.ledger).toEqual([]);
    expect(() => assertPermission(salesperson, "refund:approve")).toThrow(AppError);
  });
});

describe("leads and reminders", () => {
  it("rejects a second open lead with the same phone and creates a follow-up task", () => {
    const { db, owner } = setup();
    createLead(db, owner, { name: "Kavya", phone: "9845022222", source: "Website" });
    expect(() => createLead(db, owner, { name: "Kavya Hegde", phone: "9845022222", source: "WhatsApp" })).toThrow(/open lead/i);
    const tasks = db.prepare(`SELECT COUNT(*) AS total FROM tasks WHERE business_id = ?`).get(owner.businessId) as { total: number };
    expect(tasks.total).toBe(1);
  });

  it("blocks a due reminder while a payment is pending", () => {
    const { db, owner } = setup();
    const customer = createCustomer(db, owner, { name: "Imran", phone: "9845033333" }) as { id: string };
    dispatchAction(db, owner, "opening.receivable", { customerId: customer.id, amountPaise: 50000 });
    recordPayment(db, owner, { customerId: customer.id, method: "upi", status: "pending", amountPaise: 50000, reference: "UPI1", provider: "upi" });
    const message = draftReminder(db, owner, customer.id, "whatsapp") as { status: string; body: string };
    expect(message.status).toBe("blocked");
    expect(message.body).toBe("");
  });
});

describe("commerce and finance", () => {
  it("invoices a paid order once, keeps split tenders apart, and reverses a refund", () => {
    const { db, owner } = setup();
    const product = createProduct(db, owner, { name: "Lamp", sku: "LAMP", sellingPricePaise: 240000, purchaseCostPaise: 110000 });
    moveStock(db, owner, { variantId: product.variantId, quantityMilli: 5000, reason: "opening", sourceType: "seed", sourceId: "open" });
    const storeId = crypto.randomUUID();
    db.prepare(`INSERT INTO ecommerce_stores (id, business_id, provider, status, shop_domain, created_at) VALUES (?, ?, 'shopify', 'pending_configuration', NULL, ?)`).run(
      storeId,
      owner.businessId,
      new Date().toISOString()
    );
    const first = ingestOrder(db, owner, {
      externalId: "1001",
      storeId,
      customerName: "Ananya Rao",
      phone: "9845044444",
      currency: "INR",
      discountPaise: 0,
      shippingPaise: 5000,
      fulfillmentStatus: "fulfilled",
      financialStatus: "paid",
      lines: [{ sku: "LAMP", name: "Lamp", quantityMilli: 1000, unitPaise: 240000 }],
    }) as { orderId: string; duplicate: boolean };
    const second = ingestOrder(db, owner, {
      externalId: "1001",
      storeId,
      customerName: "Ananya Rao",
      phone: "9845044444",
      currency: "INR",
      discountPaise: 0,
      shippingPaise: 5000,
      fulfillmentStatus: "fulfilled",
      financialStatus: "paid",
      lines: [{ sku: "LAMP", name: "Lamp", quantityMilli: 1000, unitPaise: 240000 }],
    }) as { duplicate: boolean; orderId: string };
    expect(second.duplicate).toBe(true);
    expect(second.orderId).toBe(first.orderId);
    const stock = db.prepare(`SELECT quantity_milli FROM stock_balances WHERE variant_id = ?`).get(product.variantId) as { quantity_milli: number };
    expect(stock.quantity_milli).toBe(4000);
    const invoice = db.prepare(`SELECT * FROM invoices WHERE order_id = ?`).get(first.orderId) as { id: string; total_paise: number; customer_id: string };
    expect(invoice.total_paise).toBe(288200);
    recordPayment(db, owner, {
      customerId: invoice.customer_id,
      method: "cash",
      status: "recorded",
      amountPaise: 100000,
      allocations: [{ invoiceId: invoice.id, amountPaise: 100000 }],
    });
    const upi = recordPayment(db, owner, {
      customerId: invoice.customer_id,
      method: "upi",
      status: "pending",
      amountPaise: 188200,
      reference: "UPI-1",
      provider: "upi",
      allocations: [{ invoiceId: invoice.id, amountPaise: 188200 }],
    }) as { id: string };
    let balance = invoiceBalance(db, owner.businessId, invoice.id);
    expect(balance.bookDuePaise).toBe(188200);
    expect(balance.bankDuePaise).toBe(288200);
    dispatchAction(db, owner, "payment.transition", { id: upi.id, status: "bank_settled", reference: "UTR123", settlementEvidence: "statement" });
    balance = invoiceBalance(db, owner.businessId, invoice.id);
    expect(balance.bookDuePaise).toBe(0);
    expect(balance.bankSettledPaise).toBe(188200);
    const cash = db.prepare(`SELECT id FROM payment_transactions WHERE method = 'cash'`).get() as { id: string };
    dispatchAction(db, owner, "refund.create", { paymentId: cash.id, amountPaise: 20000, reference: "CASH-R" });
    const ledgerCount = db.prepare(`SELECT COUNT(*) AS total FROM ledger_entries WHERE source_type = 'payment' AND source_id = ?`).get(cash.id) as { total: number };
    expect(ledgerCount.total).toBeGreaterThan(0);
    const original = db.prepare(`SELECT amount_paise, status FROM payment_transactions WHERE id = ?`).get(cash.id) as { amount_paise: number; status: string };
    expect(original.amount_paise).toBe(100000);
    expect(original.status).toBe("recorded");
    expect(() => dispatchAction(db, { ...owner, role: "salesperson" }, "refund.create", { paymentId: cash.id, amountPaise: 100 })).toThrow(AppError);
  });

  it("refuses invoices for a non-ecommerce business and refuses a bank-settled UPI without evidence", () => {
    const { db, owner, other } = setup();
    expect(() =>
      ingestOrder(db, other, {
        externalId: "9",
        storeId: "missing",
        customerName: "A",
        currency: "INR",
        discountPaise: 0,
        shippingPaise: 0,
        fulfillmentStatus: "unfulfilled",
        financialStatus: "paid",
        lines: [],
      })
    ).toThrow(/e-commerce/i);
    const customer = createCustomer(db, owner, { name: "R", phone: "9000000000" }) as { id: string };
    expect(() => recordPayment(db, owner, { customerId: customer.id, method: "upi", status: "bank_settled", amountPaise: 100 })).toThrow(/evidence/i);
  });
});

describe("webhooks, backup, brain, currency", () => {
  it("rejects a bad signature and does not double-apply a webhook", () => {
    const { db, owner } = setup();
    process.env.SHOPIFY_API_SECRET = "shpss_test_secret";
    createProduct(db, owner, { name: "Lamp", sku: "LAMP", sellingPricePaise: 10000, purchaseCostPaise: 4000 });
    db.prepare(`INSERT INTO integrations (id, business_id, provider, category, status, detail, created_at) VALUES (?, ?, 'shopify', 'ecommerce', 'pending_configuration', '', ?)`).run(
      crypto.randomUUID(),
      owner.businessId,
      new Date().toISOString()
    );
    db.prepare(`INSERT INTO ecommerce_stores (id, business_id, provider, status, shop_domain, created_at) VALUES (?, ?, 'shopify', 'pending_configuration', NULL, ?)`).run(
      crypto.randomUUID(),
      owner.businessId,
      new Date().toISOString()
    );
    const body = JSON.stringify({
      id: 55,
      currency: "INR",
      financial_status: "paid",
      fulfillment_status: null,
      customer: { first_name: "A", last_name: "B", phone: "9845055555" },
      line_items: [{ sku: "LAMP", title: "Lamp", quantity: 1, price: "100.00" }],
    });
    expect(() => acceptWebhook(db, { provider: "shopify", rawBody: body, signature: "nope", eventId: "evt-1", businessId: owner.businessId })).toThrow(/signature/i);
    const signature = hmacBase64("shpss_test_secret", body);
    const first = acceptWebhook(db, { provider: "shopify", rawBody: body, signature, eventId: "evt-1", businessId: owner.businessId });
    const second = acceptWebhook(db, { provider: "shopify", rawBody: body, signature, eventId: "evt-1", businessId: owner.businessId });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    processQueuedJobs(db, owner);
    processQueuedJobs(db, owner);
    const orders = db.prepare(`SELECT COUNT(*) AS total FROM ecommerce_orders WHERE business_id = ?`).get(owner.businessId) as { total: number };
    expect(orders.total).toBe(1);
  });

  it("restores a snapshot into a second database and leaves old currency rows untouched", () => {
    const { db, owner } = setup();
    const customer = createCustomer(db, owner, { name: "Meera", phone: "9845066666" }) as { id: string };
    dispatchAction(db, owner, "opening.receivable", { customerId: customer.id, amountPaise: 250000 });
    const snapshot = exportBusiness(db, owner);
    const restored = restoreSnapshot({ sha256: snapshot.sha256, payload: snapshot.payload as Record<string, Array<Record<string, unknown>>> });
    expect(restored.counts.customers).toBe(1);
    expect(restored.counts.ledger_entries).toBeGreaterThan(0);
    restored.db.close();
    dispatchAction(db, owner, "business.currency", { currency: "USD" });
    const rows = db.prepare(`SELECT currency FROM ledger_entries WHERE business_id = ?`).all(owner.businessId) as Array<{ currency: string }>;
    expect(rows.every((row) => row.currency === "INR")).toBe(true);
    const business = db.prepare(`SELECT currency FROM businesses WHERE id = ?`).get(owner.businessId) as { currency: string };
    expect(business.currency).toBe("USD");
  });

  it("cites records and will not execute a refund without approval", () => {
    const { db, owner } = setup();
    const customer = createCustomer(db, owner, { name: "Imran", phone: "9845077777" }) as { id: string };
    dispatchAction(db, owner, "opening.receivable", { customerId: customer.id, amountPaise: 80000 });
    const brain = runBrain(db, owner);
    expect(brain.mode).toBe("deterministic");
    expect(brain.insights.some((insight) => insight.kind === "fact" && insight.evidence.length > 0)).toBe(true);
    const approval = dispatchAction(db, owner, "approval.propose", {
      actionName: "refund",
      payload: { paymentId: "missing", amountPaise: 100 },
    }) as { status: string };
    expect(approval.status).toBe("pending");
    const refunds = db.prepare(`SELECT COUNT(*) AS total FROM refunds`).get() as { total: number };
    expect(refunds.total).toBe(0);
  });
});
