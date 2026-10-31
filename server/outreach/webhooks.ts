import { createHash } from "crypto";
import type Database from "better-sqlite3";
import { applyProviderStatus, receiveInbound } from "@/server/outreach/engine";
import { testProviders, verifyEmailHmac, verifyMetaSignature, verifySvix, type ProviderSet } from "@/server/outreach/providers";

function remember(db: Database.Database, businessId: string, provider: string, externalId: string, valid: boolean, status: string) {
  db.prepare(`INSERT INTO outreach_webhook_events (id, business_id, provider, external_event_id, signature_valid, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    crypto.randomUUID(),
    businessId,
    provider,
    externalId,
    valid ? 1 : 0,
    status,
    new Date().toISOString()
  );
}

function seen(db: Database.Database, businessId: string, provider: string, externalId: string) {
  return !!db.prepare(`SELECT id FROM outreach_webhook_events WHERE business_id = ? AND provider = ? AND external_event_id = ?`).get(businessId, provider, externalId);
}

export function acceptWhatsAppWebhook(db: Database.Database, businessId: string, rawBody: string, signature: string | null, secret: string | undefined, providers: ProviderSet = testProviders()) {
  const business = db.prepare(`SELECT id FROM businesses WHERE id = ?`).get(businessId);
  if (!business) return { status: 404, body: { ok: false, reason: "Business not found" } };
  let payload: { entry?: { changes?: { value?: { messages?: { id?: string; from?: string; text?: { body?: string }; interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } } }[]; statuses?: { id?: string; status?: string }[] } }[] }[] } = {};
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return { status: 400, body: { ok: false, reason: "Invalid JSON" } };
  }
  const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const status = payload.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
  const eventId = message?.id ? `message:${message.id}` : status?.id ? `status:${status.id}:${status.status}` : createHash("sha256").update(rawBody).digest("hex");
  if (!verifyMetaSignature(rawBody, signature, secret)) {
    remember(db, businessId, "whatsapp", `invalid:${eventId}:${crypto.randomUUID()}`, false, "rejected");
    return { status: 401, body: { ok: false, reason: "Invalid signature" } };
  }
  if (seen(db, businessId, "whatsapp", eventId)) return { status: 200, body: { ok: true, duplicate: true } };
  remember(db, businessId, "whatsapp", eventId, true, "processed");
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  const now = new Date();
  for (const status of value?.statuses ?? []) {
    if (status.id && status.status) applyProviderStatus(db, businessId, status.id, status.status);
  }
  for (const message of value?.messages ?? []) {
    const text = message.text?.body || message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || message.interactive?.button_reply?.id || "";
    if (!text || !message.from) continue;
    receiveInbound(db, businessId, { phone: message.from, text, providerMessageId: message.id, origin: "webhook" }, now, providers);
  }
  return { status: 200, body: { ok: true } };
}

export function acceptEmailWebhook(
  db: Database.Database,
  businessId: string,
  rawBody: string,
  headers: { hmac: string | null; id: string | null; timestamp: string | null; signature: string | null },
  secret: string | undefined,
  providers: ProviderSet = testProviders()
) {
  const business = db.prepare(`SELECT id FROM businesses WHERE id = ?`).get(businessId);
  if (!business) return { status: 404, body: { ok: false, reason: "Business not found" } };
  const valid = verifyEmailHmac(rawBody, headers.hmac, secret) || verifySvix(rawBody, headers.id, headers.timestamp, headers.signature, secret);
  let payload: { id?: string; type?: string; text?: string; from?: string; to?: string; email?: string } = {};
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return { status: 400, body: { ok: false, reason: "Invalid JSON" } };
  }
  const eventId = payload.id || headers.id || createHash("sha256").update(rawBody).digest("hex");
  if (!valid) {
    remember(db, businessId, "email", `invalid:${eventId}:${crypto.randomUUID()}`, false, "rejected");
    return { status: 401, body: { ok: false, reason: "Invalid signature" } };
  }
  if (seen(db, businessId, "email", eventId)) return { status: 200, body: { ok: true, duplicate: true } };
  remember(db, businessId, "email", eventId, true, "processed");
  const now = new Date();
  if (payload.type === "email.bounced" || payload.type === "email.complained") {
    const address = (payload.email || payload.from || "").toLowerCase();
    if (address) {
      db.prepare(`INSERT OR IGNORE INTO suppression_list (id, business_id, channel, address, reason, created_at) VALUES (?, ?, 'email', ?, ?, ?)`).run(crypto.randomUUID(), businessId, address, payload.type, now.toISOString());
      const lead = db.prepare(`SELECT id FROM outreach_leads WHERE business_id = ? AND lower(email) = ?`).get(businessId, address) as { id: string } | undefined;
      if (lead) {
        db.prepare(`UPDATE consents SET withdrawn_at = ? WHERE lead_id = ? AND channel = 'email' AND withdrawn_at IS NULL`).run(now.toISOString(), lead.id);
        db.prepare(`UPDATE sequence_enrollments SET status = 'stopped', stop_reason = 'channel_failed', next_run_at = NULL WHERE lead_id = ? AND status IN ('active','waiting_approval')`).run(lead.id);
      }
    }
    return { status: 200, body: { ok: true, suppressed: true } };
  }
  const leadId = payload.to?.match(/lead-([0-9a-f-]{36})/i)?.[1];
  receiveInbound(db, businessId, { leadId, email: payload.from, text: payload.text || "", providerMessageId: payload.id, origin: "webhook" }, now, providers);
  return { status: 200, body: { ok: true } };
}
