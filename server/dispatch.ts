import type Database from "better-sqlite3";
import { proposeHighImpact } from "@/server/brain";
import { runBrain } from "@/server/brain";
import { exportBusiness, verifySnapshot } from "@/server/backup";
import type { Actor } from "@/server/db";
import { nowIso } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  createRefund,
  issueCreditNote,
  issueInvoiceForOrder,
  postOpeningReceivable,
  recordExpense,
  recordPayment,
  transitionPayment,
} from "@/server/finance";
import { connectIntegration, processQueuedJobs } from "@/server/integrations";
import { hashToken } from "@/server/auth";
import { assertPermission } from "@/server/permissions";
import {
  createCustomer,
  createLead,
  createProduct,
  createTask,
  draftReminder,
  importCustomers,
  ingestOrder,
  moveStock,
  updateCustomer,
  updateLeadStage,
} from "@/server/records";
import { audit } from "@/server/audit";

type Input = Record<string, unknown>;

function str(input: Input, key: string) {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) throw new AppError(422, "INVALID_INPUT", `${key} is required`);
  return value.trim();
}

function optionalString(input: Input, key: string) {
  const value = input[key];
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new AppError(422, "INVALID_INPUT", `${key} must be a string`);
  return value.trim();
}

function int(input: Input, key: string) {
  const value = input[key];
  if (typeof value !== "number" || !Number.isInteger(value)) throw new AppError(422, "INVALID_INPUT", `${key} must be an integer`);
  return value;
}

export function dispatchAction(db: Database.Database, actor: Actor, action: string, input: Input) {
  switch (action) {
    case "customer.create":
      return createCustomer(db, actor, { name: str(input, "name"), phone: optionalString(input, "phone"), email: optionalString(input, "email"), notes: optionalString(input, "notes") ?? "" });
    case "customer.update":
      return updateCustomer(db, actor, str(input, "id"), {
        name: optionalString(input, "name") ?? undefined,
        phone: optionalString(input, "phone"),
        email: optionalString(input, "email"),
        notes: optionalString(input, "notes") ?? undefined,
      });
    case "lead.create":
      return createLead(db, actor, {
        name: str(input, "name"),
        phone: optionalString(input, "phone"),
        email: optionalString(input, "email"),
        source: str(input, "source"),
        requirement: optionalString(input, "requirement") ?? "",
        budgetPaise: input.budgetPaise === undefined ? null : int(input, "budgetPaise"),
      });
    case "lead.stage":
      return updateLeadStage(db, actor, str(input, "id"), str(input, "stage"));
    case "product.create":
      return createProduct(db, actor, {
        name: str(input, "name"),
        sku: str(input, "sku"),
        sellingPricePaise: int(input, "sellingPricePaise"),
        purchaseCostPaise: input.purchaseCostPaise === undefined ? null : int(input, "purchaseCostPaise"),
      });
    case "stock.move":
      return moveStock(db, actor, {
        variantId: str(input, "variantId"),
        quantityMilli: int(input, "quantityMilli"),
        reason: str(input, "reason"),
        sourceType: "adjustment",
        sourceId: str(input, "sourceId"),
      });
    case "order.ingest":
      return ingestOrder(db, actor, {
        externalId: str(input, "externalId"),
        storeId: str(input, "storeId"),
        customerName: str(input, "customerName"),
        phone: optionalString(input, "phone"),
        currency: "INR",
        discountPaise: input.discountPaise === undefined ? 0 : int(input, "discountPaise"),
        shippingPaise: input.shippingPaise === undefined ? 0 : int(input, "shippingPaise"),
        fulfillmentStatus: (optionalString(input, "fulfillmentStatus") as "fulfilled" | "unfulfilled") || "unfulfilled",
        financialStatus: optionalString(input, "financialStatus") || "pending",
        lines: Array.isArray(input.lines) ? (input.lines as never) : [],
      });
    case "invoice.issue":
      return issueInvoiceForOrder(db, actor, str(input, "orderId"));
    case "payment.record":
      return recordPayment(db, actor, {
        customerId: optionalString(input, "customerId"),
        method: str(input, "method") as "cash" | "upi" | "card" | "bank" | "credit",
        status: str(input, "status"),
        amountPaise: int(input, "amountPaise"),
        reference: optionalString(input, "reference"),
        provider: optionalString(input, "provider"),
        settlementEvidence: optionalString(input, "settlementEvidence"),
        idempotencyKey: optionalString(input, "idempotencyKey"),
        allocations: Array.isArray(input.allocations) ? (input.allocations as { invoiceId?: string; amountPaise: number }[]) : [],
      });
    case "payment.transition":
      return transitionPayment(db, actor, str(input, "id"), str(input, "status"), {
        reference: optionalString(input, "reference") ?? undefined,
        settlementEvidence: optionalString(input, "settlementEvidence") ?? undefined,
      });
    case "refund.create":
      return createRefund(db, actor, { paymentId: str(input, "paymentId"), amountPaise: int(input, "amountPaise"), reference: optionalString(input, "reference") ?? undefined });
    case "creditNote.create":
      return issueCreditNote(db, actor, { invoiceId: str(input, "invoiceId"), amountPaise: int(input, "amountPaise"), reason: str(input, "reason") });
    case "expense.create":
      return recordExpense(db, actor, { categoryName: str(input, "categoryName"), amountPaise: int(input, "amountPaise"), incurredOn: str(input, "incurredOn"), memo: optionalString(input, "memo") ?? "" });
    case "opening.receivable":
      return postOpeningReceivable(db, actor, str(input, "customerId"), int(input, "amountPaise"));
    case "task.create":
      return createTask(db, actor, { title: str(input, "title"), detail: optionalString(input, "detail") ?? "", dueAt: optionalString(input, "dueAt") });
    case "message.draft":
      return draftReminder(db, actor, str(input, "customerId"), str(input, "channel") as "whatsapp" | "email");
    case "campaign.create":
      return createCampaign(db, actor, str(input, "name"), str(input, "objective"), input.budgetPaise === undefined ? null : int(input, "budgetPaise"));
    case "review.create":
      return createManualReview(db, actor, int(input, "rating"), str(input, "body"));
    case "brain.run":
      return runBrain(db, actor);
    case "approval.propose":
      return proposeHighImpact(db, actor, str(input, "actionName"), input.payload ?? {});
    case "approval.decide":
      return decideApproval(db, actor, str(input, "id"), str(input, "decision"));
    case "integration.connect":
      return connectIntegration(db, actor, str(input, "provider"));
    case "jobs.process":
      return processQueuedJobs(db, actor);
    case "backup.create":
      return exportBusiness(db, actor);
    case "backup.verify":
      return verifySnapshot(db, actor, str(input, "id"));
    case "import.customers":
      return importCustomers(db, actor, str(input, "csv"));
    case "member.invite":
      return inviteMember(db, actor, str(input, "email"), str(input, "role"));
    case "business.currency":
      return changeDefaultCurrency(db, actor, str(input, "currency"));
    default:
      throw new AppError(404, "UNKNOWN_ACTION", "That action is not available");
  }
}

function createCampaign(db: Database.Database, actor: Actor, name: string, objective: string, budgetPaise: number | null) {
  assertPermission(actor, "campaign:create");
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO campaigns (id, business_id, name, objective, status, budget_paise, created_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)`).run(
    id,
    actor.businessId,
    name,
    objective,
    budgetPaise,
    nowIso()
  );
  audit(db, actor, "campaign.created", "campaign", id, { name });
  return db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id);
}

function createManualReview(db: Database.Database, actor: Actor, rating: number, body: string) {
  assertPermission(actor, "campaign:create");
  if (rating < 1 || rating > 5) throw new AppError(422, "INVALID_RATING", "Rating must be from 1 to 5");
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO reviews (id, business_id, source, rating, body, created_at) VALUES (?, ?, 'manual', ?, ?, ?)`).run(id, actor.businessId, rating, body, nowIso());
  return db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(id);
}

function inviteMember(db: Database.Database, actor: Actor, email: string, role: string) {
  assertPermission(actor, "member:create");
  const token = crypto.randomUUID();
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO invitations (id, business_id, email, role, token_hash, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)`).run(
    id,
    actor.businessId,
    email.toLowerCase(),
    role,
    hashToken(token),
    nowIso()
  );
  audit(db, actor, "member.invited", "invitation", id, { email, role, delivered: false });
  return { id, delivered: false, message: "Invitation stored. Email delivery is not configured, so it was not sent." };
}

function decideApproval(db: Database.Database, actor: Actor, id: string, decision: string) {
  assertPermission(actor, "refund:approve");
  const row = db.prepare(`SELECT * FROM approvals WHERE id = ?`).get(id) as
    | { id: string; business_id: string; status: string; action: string; payload_json: string }
    | undefined;
  if (!row || row.business_id !== actor.businessId) throw new AppError(404, "NOT_FOUND", "Approval not found");
  if (row.status !== "pending") throw new AppError(409, "ALREADY_DECIDED", "This approval is already decided");
  if (decision === "rejected") {
    db.prepare(`UPDATE approvals SET status = 'rejected', decided_by = ? WHERE id = ?`).run(actor.userId, id);
    return db.prepare(`SELECT * FROM approvals WHERE id = ?`).get(id);
  }
  if (decision !== "approved") throw new AppError(422, "INVALID_DECISION", "Decision must be approved or rejected");
  const payload = JSON.parse(row.payload_json) as { paymentId?: string; amountPaise?: number };
  let result: unknown = null;
  if (row.action === "refund") {
    if (!payload.paymentId || !payload.amountPaise) throw new AppError(422, "INVALID_APPROVAL", "Refund approval is missing payment details");
    result = createRefund(db, actor, { paymentId: payload.paymentId, amountPaise: payload.amountPaise });
  }
  db.prepare(`UPDATE approvals SET status = 'executed', decided_by = ?, result_json = ? WHERE id = ?`).run(actor.userId, JSON.stringify(result), id);
  audit(db, actor, "approval.executed", "approval", id, { action: row.action });
  return db.prepare(`SELECT * FROM approvals WHERE id = ?`).get(id);
}

function changeDefaultCurrency(db: Database.Database, actor: Actor, currency: string) {
  assertPermission(actor, "ledger:approve");
  if (!/^[A-Z]{3}$/.test(currency)) throw new AppError(422, "INVALID_CURRENCY", "Use a 3-letter currency code");
  const before = db.prepare(`SELECT currency, amount_paise FROM ledger_entries WHERE business_id = ?`).all(actor.businessId);
  db.prepare(`UPDATE businesses SET currency = ? WHERE id = ?`).run(currency, actor.businessId);
  const after = db.prepare(`SELECT currency, amount_paise FROM ledger_entries WHERE business_id = ?`).all(actor.businessId);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new AppError(500, "CURRENCY_REWRITE", "Historical ledger rows were changed");
  }
  audit(db, actor, "business.currency", "business", actor.businessId, { currency });
  return { currency, historicalRowsUntouched: before.length };
}