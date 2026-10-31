import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { registerAccount } from "@/server/auth";
import { openDatabase } from "@/server/db";
import { extractAnswer } from "@/lib/qualification/extract";
import { isOptOut } from "@/lib/qualification/language";
import { defaultQuestions } from "@/lib/qualification/defaults";
import { defaultBudgetRanges, defaultServiceAreas, normalizeBudget, normalizeLocality, normalizeSize } from "@/lib/qualification/normalize";
import { scoreFromAnswers } from "@/lib/qualification/rules";
import { nextAllowedSend } from "@/lib/qualification/schedule";
import { nextDeliveryStatus } from "@/lib/qualification/window";
import { arriveLead, outreachSnapshot, placeFreeform, receiveInbound, takeOver, handBack, tickSequences } from "@/server/outreach/engine";
import { liveProviders, testProviders, verifySvix } from "@/server/outreach/providers";
import { acceptEmailWebhook, acceptWhatsAppWebhook } from "@/server/outreach/webhooks";

const EXTRACTION_ACCURACY_THRESHOLD = 0.8;
const now = new Date("2026-10-31T05:00:00.000Z");

function studio() {
  const db = openDatabase(":memory:");
  const account = registerAccount(db, {
    name: "Rohan",
    email: `owner-${crypto.randomUUID()}@example.com`,
    password: "password1234",
    businessName: "Studio Aangan",
    city: "Bengaluru",
    businessType: "interior",
    ecommerceBilling: false,
  });
  return { db, businessId: account.businessId, providers: testProviders() };
}

function outbound(db: ReturnType<typeof openDatabase>, leadId: string) {
  return db.prepare(`SELECT status, body, channel, cost_category, origin, error, provider_message_id FROM outreach_messages WHERE lead_id = ? AND direction = 'outbound' ORDER BY created_at`).all(leadId) as {
    status: string;
    body: string;
    channel: string;
    cost_category: string | null;
    origin: string;
    error: string | null;
    provider_message_id: string | null;
  }[];
}

const samples: { field: string; text: string; expected: string }[] = [
  { field: "project_scope", text: "Full home", expected: "full_home" },
  { field: "project_scope", text: "full home", expected: "full_home" },
  { field: "project_scope", text: "kitchen", expected: "kitchen" },
  { field: "project_scope", text: "1", expected: "full_home" },
  { field: "project_scope", text: "wardrobes", expected: "wardrobes" },
  { field: "project_scope", text: "living room", expected: "living" },
  { field: "project_scope", text: "office", expected: "office" },
  { field: "project_scope", text: "पूरा घर", expected: "full_home" },
  { field: "project_scope", text: "किचन", expected: "kitchen" },
  { field: "project_scope", text: "ಕಿಚನ್", expected: "kitchen" },
  { field: "property_type", text: "Apartment", expected: "apartment" },
  { field: "property_type", text: "flat", expected: "apartment" },
  { field: "property_type", text: "फ्लैट", expected: "apartment" },
  { field: "property_type", text: "villa", expected: "villa" },
  { field: "property_type", text: "independent house", expected: "villa" },
  { field: "property_type", text: "shop", expected: "shop" },
  { field: "property_type", text: "restaurant", expected: "shop" },
  { field: "size", text: "3bhk", expected: "3BHK" },
  { field: "size", text: "3 bhk", expected: "3BHK" },
  { field: "size", text: "3BHK flat", expected: "3BHK" },
  { field: "size", text: "2BHK", expected: "2BHK" },
  { field: "size", text: "1450 sqft", expected: "1450 sq ft" },
  { field: "size", text: "1450 sq ft", expected: "1450 sq ft" },
  { field: "size", text: "1,450 square feet", expected: "1450 sq ft" },
  { field: "size", text: "3 bhk 1450 sqft", expected: "3BHK, 1450 sq ft" },
  { field: "location", text: "Jayanagar", expected: "Jayanagar" },
  { field: "location", text: "jayanagar", expected: "Jayanagar" },
  { field: "location", text: "jaya nagar", expected: "Jayanagar" },
  { field: "location", text: "जय नगर", expected: "Jayanagar" },
  { field: "location", text: "ಜಯನಗರ", expected: "Jayanagar" },
  { field: "location", text: "Koramangala", expected: "Koramangala" },
  { field: "location", text: "hsr layout", expected: "HSR Layout" },
  { field: "location", text: "Whitefield", expected: "Whitefield" },
  { field: "location", text: "Bengaluru", expected: "Bengaluru" },
  { field: "location", text: "bangalore", expected: "Bengaluru" },
  { field: "possession_status", text: "Yes", expected: "yes" },
  { field: "possession_status", text: "already", expected: "yes" },
  { field: "possession_status", text: "हाँ", expected: "yes" },
  { field: "possession_status", text: "Expected soon", expected: "soon" },
  { field: "possession_status", text: "Not yet", expected: "not_yet" },
  { field: "timeline", text: "Within a month", expected: "within_month" },
  { field: "timeline", text: "immediately", expected: "within_month" },
  { field: "timeline", text: "1-3 months", expected: "1_3" },
  { field: "timeline", text: "3-6 months", expected: "3_6" },
  { field: "timeline", text: "Just exploring", expected: "exploring" },
  { field: "timeline", text: "just looking", expected: "exploring" },
  { field: "budget_range", text: "Under 3L", expected: "under_3" },
  { field: "budget_range", text: "3-8L", expected: "3_8" },
  { field: "budget_range", text: "around 10 lakhs", expected: "8_15" },
  { field: "budget_range", text: "10L", expected: "8_15" },
  { field: "budget_range", text: "10 लाख", expected: "8_15" },
  { field: "budget_range", text: "10 ಲಕ್ಷ", expected: "8_15" },
  { field: "budget_range", text: "30L+", expected: "30_plus" },
  { field: "budget_range", text: "2 lakhs", expected: "under_3" },
  { field: "decision_maker", text: "My spouse", expected: "My spouse" },
  { field: "style", text: "Warm wood and linen", expected: "Warm wood and linen" },
];

describe("qualification rules", () => {
  it("normalizes size, budget, and locality in English, Hindi, and Kannada", () => {
    expect(normalizeSize("3 bhk").normalized).toBe("3BHK");
    expect(normalizeSize("1450 sqft").normalized).toBe("1450 sq ft");
    expect(normalizeBudget("around 10 lakhs", defaultBudgetRanges).normalized).toBe("8_15");
    expect(normalizeBudget("10 लाख", defaultBudgetRanges).normalized).toBe("8_15");
    expect(normalizeBudget("10 ಲಕ್ಷ", defaultBudgetRanges).normalized).toBe("8_15");
    expect(normalizeLocality("ಜಯನಗರ", defaultServiceAreas).normalized).toBe("Jayanagar");
    expect(normalizeLocality("जय नगर", defaultServiceAreas).normalized).toBe("Jayanagar");
  });

  it("keeps the score in the rule function", () => {
    const scored = scoreFromAnswers({ budget_range: "8_15", timeline: "within_month", project_scope: "full_home" }, true);
    expect(scored.score).toBeGreaterThan(0);
    expect(scored.reasons.length).toBeGreaterThan(0);
  });

  it("moves quiet-hour sends to the next 9:00 IST", () => {
    expect(nextAllowedSend(new Date("2026-10-30T16:30:00.000Z")).toISOString()).toBe("2026-10-31T03:30:00.000Z");
    expect(nextAllowedSend(new Date("2026-10-31T02:30:00.000Z")).toISOString()).toBe("2026-10-31T03:30:00.000Z");
    expect(nextAllowedSend(new Date("2026-10-31T05:00:00.000Z")).toISOString()).toBe("2026-10-31T05:00:00.000Z");
    expect(nextAllowedSend(new Date("2026-10-31T05:00:00.000Z"), "21:00", "09:00", ["2026-10-31"]).toISOString()).toBe("2026-11-01T03:30:00.000Z");
  });

  it("detects opt-out words and ignores stopwatch", () => {
    expect(isOptOut("STOP")).toBe(true);
    expect(isOptOut("please unsubscribe")).toBe(true);
    expect(isOptOut("band karo")).toBe(true);
    expect(isOptOut("ನಿಲ್ಲಿಸಿ")).toBe(true);
    expect(isOptOut("stopwatch")).toBe(false);
  });

  it("does not move a read receipt backwards", () => {
    expect(nextDeliveryStatus("read", "delivered")).toBe("read");
    expect(nextDeliveryStatus("sent", "delivered")).toBe("delivered");
  });

  it("keeps extraction accuracy at or above the threshold", () => {
    let correct = 0;
    for (const sample of samples) {
      const question = defaultQuestions.find((item) => item.field === sample.field);
      const extracted = extractAnswer({
        field: sample.field,
        text: sample.text,
        options: question?.options ?? [],
        ranges: defaultBudgetRanges,
        areas: defaultServiceAreas,
        evidenceMessageId: "sample",
      });
      if (extracted.normalized_value === sample.expected) correct += 1;
    }
    expect(samples.length).toBeGreaterThanOrEqual(50);
    expect(correct / samples.length).toBeGreaterThanOrEqual(EXTRACTION_ACCURACY_THRESHOLD);
  });
});

describe("qualification conversations", () => {
  it("qualifies a WhatsApp lead and books a visit", () => {
    const { db, businessId, providers } = studio();
    const created = arriveLead(db, businessId, { name: "Meera", phone: "9845300099", source: "Website", consents: [{ channel: "whatsapp", basis: "form checkbox", source: "website" }] }, now, providers);
    expect(created.ok).toBe(true);
    if (!created.ok || !("leadId" in created)) return;
    const replies = ["Full home", "Apartment", "3BHK 1450 sqft", "Jayanagar", "Yes", "Within a month", "around 10 lakhs"];
    let clock = new Date(now.getTime() + 6 * 60 * 1000);
    for (const text of replies) {
      receiveInbound(db, businessId, { leadId: created.leadId, text, origin: "webhook" }, clock, providers);
      clock = new Date(clock.getTime() + 60 * 1000);
    }
    const stage = db.prepare(`SELECT stage, score FROM outreach_leads WHERE id = ?`).get(created.leadId) as { stage: string; score: number };
    expect(stage.stage).toBe("qualified");
    expect(stage.score).toBeGreaterThan(0);
    receiveInbound(db, businessId, { leadId: created.leadId, text: "1", origin: "webhook" }, clock, providers);
    const booked = db.prepare(`SELECT stage FROM outreach_leads WHERE id = ?`).get(created.leadId) as { stage: string };
    expect(booked.stage).toBe("site_visit_scheduled");
    expect((db.prepare(`SELECT COUNT(*) AS total FROM sequence_enrollments WHERE lead_id = ? AND status = 'active'`).get(created.leadId) as { total: number }).total).toBe(0);
    expect((db.prepare(`SELECT COUNT(*) AS total FROM notifications WHERE business_id = ? AND title = 'Site visit booked'`).get(businessId) as { total: number }).total).toBe(1);
    expect(outbound(db, created.leadId).some((message) => message.status === "sent")).toBe(true);
    expect(outbound(db, created.leadId).every((message) => message.status === "sent" || message.status === "scheduled")).toBe(true);
  });

  it("marks a silent lead cold after the follow-up sequence", () => {
    const { db, businessId, providers } = studio();
    const created = arriveLead(db, businessId, { name: "Silent", phone: "9845300088", source: "Website", consents: [{ channel: "whatsapp", basis: "form checkbox", source: "website" }] }, now, providers);
    if (!created.ok || !("leadId" in created)) throw new Error("lead");
    for (let day = 1; day <= 16; day += 1) tickSequences(db, businessId, new Date(now.getTime() + day * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), providers);
    expect((db.prepare(`SELECT stage FROM outreach_leads WHERE id = ?`).get(created.leadId) as { stage: string }).stage).toBe("cold");
    expect(outbound(db, created.leadId)).toHaveLength(5);
    expect(outbound(db, created.leadId).some((message) => message.cost_category === "marketing")).toBe(true);
  });

  it("stops after STOP and sends one confirmation", () => {
    const { db, businessId, providers } = studio();
    const created = arriveLead(db, businessId, { name: "Kavya", phone: "9845300077", source: "Website", consents: [{ channel: "whatsapp", basis: "form checkbox", source: "website" }] }, now, providers);
    if (!created.ok || !("leadId" in created)) throw new Error("lead");
    receiveInbound(db, businessId, { leadId: created.leadId, text: "STOP", origin: "webhook" }, new Date(now.getTime() + 60 * 60 * 1000), providers);
    tickSequences(db, businessId, new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), providers);
    const messages = outbound(db, created.leadId);
    expect(messages).toHaveLength(2);
    expect(messages.some((message) => message.body.toLowerCase().includes("opted out"))).toBe(true);
    expect((db.prepare(`SELECT stage FROM outreach_leads WHERE id = ?`).get(created.leadId) as { stage: string }).stage).toBe("opted_out");
  });

  it("pauses while a salesperson has the conversation", () => {
    const { db, businessId, providers } = studio();
    const created = arriveLead(db, businessId, { name: "Arun", phone: "9845300066", source: "Website", consents: [{ channel: "whatsapp", basis: "form checkbox", source: "website" }] }, now, providers);
    if (!created.ok || !("leadId" in created)) throw new Error("lead");
    receiveInbound(db, businessId, { leadId: created.leadId, text: "Full home", origin: "webhook" }, new Date(now.getTime() + 10 * 60 * 1000), providers);
    const before = outbound(db, created.leadId).length;
    takeOver(db, businessId, created.leadId, now);
    receiveInbound(db, businessId, { leadId: created.leadId, text: "Apartment", origin: "webhook" }, new Date(now.getTime() + 20 * 60 * 1000), providers);
    expect(outbound(db, created.leadId)).toHaveLength(before);
    handBack(db, businessId, created.leadId, new Date(now.getTime() + 30 * 60 * 1000), providers);
    expect(outbound(db, created.leadId).length).toBeGreaterThan(before);
  });

  it("uses email when there is no WhatsApp consent", () => {
    const { db, businessId, providers } = studio();
    const created = arriveLead(db, businessId, { name: "Neha", phone: "9845300055", email: "neha@example.com", source: "CSV" }, now, providers);
    expect(created.ok && "channel" in created && created.channel).toBe("email");
    const phoneOnly = arriveLead(db, businessId, { name: "No channel", phone: "9845300044", source: "CSV", imported: true }, now, providers);
    expect(phoneOnly.ok && "channel" in phoneOnly && phoneOnly.channel).toBe(null);
    expect((db.prepare(`SELECT title FROM tasks WHERE source_id = ?`).get(phoneOnly.ok ? phoneOnly.leadId : "") as { title: string }).title).toBe("No consented channel; contact manually");
  });

  it("closes a lead whose budget is below the minimum", () => {
    const { db, businessId, providers } = studio();
    const created = arriveLead(db, businessId, {
      name: "Low",
      phone: "9845300033",
      source: "Website",
      consents: [{ channel: "whatsapp", basis: "form checkbox", source: "website" }],
      known: { project_scope: "Kitchen", property_type: "Apartment", size: "2BHK", location: "Jayanagar", possession_status: "Yes", timeline: "Within a month" },
    }, now, providers);
    if (!created.ok || !("leadId" in created)) throw new Error("lead");
    receiveInbound(db, businessId, { leadId: created.leadId, text: "2 lakhs", origin: "webhook" }, new Date(now.getTime() + 10 * 60 * 1000), providers);
    expect((db.prepare(`SELECT stage FROM outreach_leads WHERE id = ?`).get(created.leadId) as { stage: string }).stage).toBe("not_a_fit");
    expect(outbound(db, created.leadId).some((message) => message.body.toLowerCase().includes("wish you"))).toBe(true);
  });

  it("refuses free-form WhatsApp outside the customer-service window", () => {
    const { db, businessId, providers } = studio();
    const created = arriveLead(db, businessId, { name: "Window", phone: "9845300022", source: "Website", consents: [{ channel: "whatsapp", basis: "form checkbox", source: "website" }] }, now, providers);
    if (!created.ok || !("leadId" in created)) throw new Error("lead");
    const placed = placeFreeform(db, businessId, created.leadId, "Can we talk about colours?", now, providers);
    expect(placed.status).toBe("queued");
    const row = db.prepare(`SELECT error FROM outreach_messages WHERE id = ?`).get(placed.id) as { error: string };
    expect(row.error).toMatch(/template/i);
  });

  it("verifies WhatsApp signatures, duplicates, and out-of-order receipts", () => {
    const { db, businessId, providers } = studio();
    const created = arriveLead(db, businessId, { name: "Receipt", phone: "9845300011", source: "Website", consents: [{ channel: "whatsapp", basis: "form checkbox", source: "website" }] }, now, providers);
    if (!created.ok || !("leadId" in created)) throw new Error("lead");
    const providerId = outbound(db, created.leadId)[0].provider_message_id;
    const secret = "meta-secret";
    const raw = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: providerId, status: "delivered" }] } }] }] });
    const sign = (body: string) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(acceptWhatsAppWebhook(db, businessId, raw, "sha256=bad", secret, providers).status).toBe(401);
    expect(acceptWhatsAppWebhook(db, businessId, raw, sign(raw), secret, providers).status).toBe(200);
    expect(acceptWhatsAppWebhook(db, businessId, raw, sign(raw), secret, providers).body).toMatchObject({ duplicate: true });
    const read = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: providerId, status: "read" }] } }] }] });
    acceptWhatsAppWebhook(db, businessId, read, sign(read), secret, providers);
    const again = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: providerId, status: "sent" }] } }] }] });
    acceptWhatsAppWebhook(db, businessId, again, sign(again), secret, providers);
    expect((db.prepare(`SELECT status FROM outreach_messages WHERE provider_message_id = ?`).get(providerId) as { status: string }).status).toBe("read");
  });

  it("suppresses an address after an email bounce", () => {
    const { db, businessId, providers } = studio();
    const created = arriveLead(db, businessId, { name: "Bounce", email: "bounce@example.com", source: "CSV", imported: true }, now, providers);
    if (!created.ok || !("leadId" in created)) throw new Error("lead");
    const secret = "email-secret";
    const raw = JSON.stringify({ id: "bounce-1", type: "email.bounced", email: "bounce@example.com" });
    const signature = createHmac("sha256", secret).update(raw).digest("hex");
    const rejected = acceptEmailWebhook(db, businessId, raw, { hmac: "nope", id: null, timestamp: null, signature: null }, secret, providers);
    expect(rejected.status).toBe(401);
    expect(acceptEmailWebhook(db, businessId, raw, { hmac: signature, id: null, timestamp: null, signature: null }, secret, providers).status).toBe(200);
    expect((db.prepare(`SELECT reason FROM suppression_list WHERE address = ?`).get("bounce@example.com") as { reason: string }).reason).toBe("email.bounced");
    expect((db.prepare(`SELECT status FROM sequence_enrollments WHERE lead_id = ?`).get(created.leadId) as { status: string }).status).toBe("stopped");
  });

  it("does not mark a live provider message as sent", () => {
    const result = liveProviders().whatsapp.send({ to: "+919845300000", body: "Hello", language: "en", category: "utility" });
    expect(result.status).toBe("awaiting_provider");
    expect(outreachSnapshot.length).toBeGreaterThan(0);
  });

  it("round-trips a Svix signature", () => {
    const raw = JSON.stringify({ id: "evt", type: "email.received" });
    const secret = `whsec_${Buffer.from("super-secret-key").toString("base64")}`;
    const id = "msg_1";
    const timestamp = "1790000000";
    const digest = createHmac("sha256", Buffer.from("super-secret-key")).update(`${id}.${timestamp}.${raw}`).digest("base64");
    expect(verifySvix(raw, id, timestamp, `v1,${digest}`, secret)).toBe(true);
    expect(verifySvix(raw, id, timestamp, "v1,wrong", secret)).toBe(false);
  });
});
