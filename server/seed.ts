import type Database from "better-sqlite3";
import { registerAccount } from "@/server/auth";
import type { Actor, Role } from "@/server/db";
import { nowIso } from "@/server/db";
import { postOpeningReceivable, recordExpense, recordPayment } from "@/server/finance";
import { createCustomer, createLead, createProduct, createTask, ingestOrder, moveStock } from "@/server/records";

function actor(db: Database.Database, userId: string, businessId: string, role: Role = "owner"): Actor {
  const business = db.prepare(`SELECT organization_id FROM businesses WHERE id = ?`).get(businessId) as { organization_id: string };
  return { userId, businessId, organizationId: business.organization_id, role };
}

function addBusiness(
  db: Database.Database,
  userId: string,
  input: { name: string; city: string; businessType: string; ecommerce: boolean; gstin?: string }
) {
  const id = crypto.randomUUID();
  const org = crypto.randomUUID();
  const at = nowIso();
  db.prepare(`INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)`).run(org, input.name, at);
  db.prepare(
    `INSERT INTO businesses
      (id, organization_id, name, city, business_type, ecommerce_billing, currency, timezone, gstin, financial_year_start_month, default_tax_bps, address, invoice_on_paid_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'INR', 'Asia/Kolkata', ?, 4, ?, '', 1, ?)`
  ).run(id, org, input.name, input.city, input.businessType, input.ecommerce ? 1 : 0, input.gstin ?? null, input.ecommerce ? 1800 : 0, at);
  db.prepare(`INSERT INTO branches (id, business_id, name, city, is_primary) VALUES (?, ?, 'Primary', ?, 1)`).run(crypto.randomUUID(), id, input.city);
  db.prepare(`INSERT INTO business_members (id, business_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)`).run(crypto.randomUUID(), id, userId, at);
  db.prepare(`INSERT INTO workflow_rules (id, business_id, name, trigger, action, enabled) VALUES (?, ?, 'Lead follow-up', 'lead.created', 'create_followup_task', 1)`).run(
    crypto.randomUUID(),
    id
  );
  return id;
}

function backdate(db: Database.Database, businessId: string, month: string) {
  db.prepare(`UPDATE invoices SET issued_at = ? WHERE business_id = ? AND issued_at >= ?`).run(
    `${month}-15T09:00:00.000Z`,
    businessId,
    new Date().toISOString().slice(0, 10)
  );
  db.prepare(
    `UPDATE ledger_entries SET created_at = ? WHERE business_id = ? AND created_at >= ? AND source_type IN ('invoice','invoice_tax')`
  ).run(`${month}-15T09:00:00.000Z`, businessId, new Date().toISOString().slice(0, 10));
}

export function seedIfEmpty(db: Database.Database) {
  const existing = db.prepare(`SELECT COUNT(*) AS total FROM users`).get() as { total: number };
  if (existing.total > 0) return;
  if (process.env.NODE_ENV === "production" && process.env.AAYAAM_SEED_DEMO !== "1") return;
  const password = process.env.AAYAAM_DEMO_PASSWORD || "aayaam-local-demo";
  const { userId, businessId: shaktiId } = registerAccount(db, {
    name: "Rohan",
    email: "rohan@aayaam.local",
    password,
    businessName: "Shakti Fitness",
    city: "Hubballi",
    businessType: "gym",
    ecommerceBilling: false,
  });
  const shakti = actor(db, userId, shaktiId);
  const member = createCustomer(db, shakti, { name: "Imran Qureshi", phone: "9845011122" }) as { id: string };
  postOpeningReceivable(db, shakti, member.id, 480000);
  recordExpense(db, shakti, { categoryName: "Rent", amountPaise: 7500000, incurredOn: nowIso().slice(0, 10), memo: "Studio rent" });
  createLead(db, shakti, { name: "Kavya Hegde", phone: "9845099911", source: "Walk-in", requirement: "Personal training, three mornings a week" });
  createTask(db, shakti, { title: "Personal training session", detail: "For Imran", dueAt: new Date().toISOString() });

  const mittiId = addBusiness(db, userId, {
    name: "Mitti Crafts",
    city: "Mysuru",
    businessType: "handicraft",
    ecommerce: true,
    gstin: "29ABCDE1234F1Z5",
  });
  const mitti = actor(db, userId, mittiId);
  const product = createProduct(db, mitti, { name: "Teak wooden lamp", sku: "LAMP-TEAK", sellingPricePaise: 240000, purchaseCostPaise: 110000 });
  moveStock(db, mitti, { variantId: product.variantId, quantityMilli: 12000, reason: "opening", sourceType: "seed", sourceId: "opening-lamp" });
  const storeId = crypto.randomUUID();
  db.prepare(`INSERT INTO ecommerce_stores (id, business_id, provider, status, shop_domain, created_at) VALUES (?, ?, 'shopify', 'pending_configuration', NULL, ?)`).run(
    storeId,
    mittiId,
    nowIso()
  );
  db.prepare(
    `INSERT INTO integrations (id, business_id, provider, category, status, detail, created_at) VALUES (?, ?, 'shopify', 'ecommerce', 'pending_configuration', 'Demo store. No live Shopify credentials.', ?)`
  ).run(crypto.randomUUID(), mittiId, nowIso());

  const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  months.forEach((month, index) => {
    const result = ingestOrder(db, mitti, {
      externalId: `seed-${month}`,
      storeId,
      customerName: index === 5 ? "Ananya Rao" : `Archive buyer ${index + 1}`,
      phone: `984510000${index}`,
      currency: "INR",
      discountPaise: 0,
      shippingPaise: 5000,
      fulfillmentStatus: "fulfilled",
      financialStatus: "paid",
      lines: [{ sku: "LAMP-TEAK", name: "Teak wooden lamp", quantityMilli: 1000, unitPaise: 240000, variantId: product.variantId }],
    }) as { orderId: string };
    backdate(db, mittiId, month);
    if (index === 5) {
      const invoice = db.prepare(`SELECT id, customer_id FROM invoices WHERE order_id = ?`).get(result.orderId) as { id: string; customer_id: string };
      recordPayment(db, mitti, {
        customerId: invoice.customer_id,
        method: "cash",
        status: "recorded",
        amountPaise: 100000,
        allocations: [{ invoiceId: invoice.id, amountPaise: 100000 }],
        idempotencyKey: "seed-cash",
      });
      recordPayment(db, mitti, {
        customerId: invoice.customer_id,
        method: "upi",
        status: "pending",
        amountPaise: 188200,
        reference: "UPI-PENDING-SEED",
        provider: "upi",
        allocations: [{ invoiceId: invoice.id, amountPaise: 188200 }],
        idempotencyKey: "seed-upi",
      });
    }
  });
  recordExpense(db, mitti, { categoryName: "Materials", amountPaise: 6400000, incurredOn: "2026-10-04", memo: "Teak and hardware" });
  createLead(db, mitti, { name: "Studio Pottery enquiry", phone: "9845200001", source: "Website", requirement: "Twelve vases for a hotel" });

  const aanganId = addBusiness(db, userId, { name: "Studio Aangan", city: "Bengaluru", businessType: "interior", ecommerce: false });
  const aangan = actor(db, userId, aanganId);
  createLead(db, aangan, { name: "Jayanagar flat", phone: "9845300001", source: "Google", requirement: "Two-bedroom interior" });
  createCustomer(db, aangan, { name: "Meera Iyer", phone: "9845300002" });
}
