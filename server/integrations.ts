import { createHmac, timingSafeEqual } from "crypto";
import type Database from "better-sqlite3";
import { audit } from "@/server/audit";
import type { Actor } from "@/server/db";
import { nowIso } from "@/server/db";
import { AppError } from "@/server/errors";
import { assertPermission } from "@/server/permissions";
import { ingestOrder, parseShopifyOrder } from "@/server/records";

export const integrationCatalog = [
  {
    provider: "shopify",
    category: "ecommerce",
    requiredEnv: ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET"],
    docs: "https://shopify.dev/docs/apps/build/webhooks/subscribe/https",
  },
  {
    provider: "woocommerce",
    category: "ecommerce",
    requiredEnv: ["WOOCOMMERCE_CONSUMER_KEY", "WOOCOMMERCE_CONSUMER_SECRET", "WOOCOMMERCE_WEBHOOK_SECRET"],
    docs: "https://woocommerce.github.io/woocommerce-rest-api-docs/",
  },
  {
    provider: "razorpay",
    category: "payments",
    requiredEnv: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"],
    docs: "https://razorpay.com/docs/webhooks/",
  },
  {
    provider: "whatsapp",
    category: "communication",
    requiredEnv: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
    docs: "https://developers.facebook.com/docs/whatsapp/cloud-api",
  },
  {
    provider: "google_business_profile",
    category: "marketing",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    docs: "https://developers.google.com/my-business/content/basic-setup",
  },
  {
    provider: "search_console",
    category: "marketing",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    docs: "https://developers.google.com/webmaster-tools/v1/api_reference_index",
  },
  {
    provider: "meta_ads",
    category: "marketing",
    requiredEnv: ["META_APP_ID", "META_APP_SECRET", "META_ACCESS_TOKEN"],
    docs: "https://developers.facebook.com/docs/marketing-apis",
  },
] as const;

export function hmacBase64(secret: string, raw: string) {
  return createHmac("sha256", secret).update(raw).digest("base64");
}

export function hmacHex(secret: string, raw: string) {
  return createHmac("sha256", secret).update(raw).digest("hex");
}

export function signaturesMatch(expected: string, received: string | null) {
  if (!received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function connectIntegration(db: Database.Database, actor: Actor, provider: string) {
  assertPermission(actor, "integration:edit");
  const known = integrationCatalog.find((item) => item.provider === provider);
  if (!known) throw new AppError(404, "UNKNOWN_PROVIDER", "That integration is not supported");
  const missing = known.requiredEnv.filter((key) => !process.env[key]);
  const status = missing.length ? "pending_configuration" : "pending_configuration";
  const detail = missing.length
    ? `Missing ${missing.join(", ")}. No live calls are made until credentials and a successful handshake exist.`
    : "Credentials are present, but a live handshake has not been verified in this environment.";
  db.prepare(
    `INSERT INTO integrations (id, business_id, provider, category, status, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(business_id, provider) DO UPDATE SET status = excluded.status, detail = excluded.detail`
  ).run(crypto.randomUUID(), actor.businessId, provider, known.category, status, detail, nowIso());
  if (provider === "shopify" || provider === "woocommerce") {
    const storeId = crypto.randomUUID();
    const existing = db.prepare(`SELECT id FROM ecommerce_stores WHERE business_id = ? AND provider = ?`).get(actor.businessId, provider) as
      | { id: string }
      | undefined;
    if (!existing) {
      db.prepare(`INSERT INTO ecommerce_stores (id, business_id, provider, status, shop_domain, created_at) VALUES (?, ?, ?, ?, NULL, ?)`).run(
        storeId,
        actor.businessId,
        provider,
        status,
        nowIso()
      );
    }
  }
  const row = db.prepare(`SELECT * FROM integrations WHERE business_id = ? AND provider = ?`).get(actor.businessId, provider);
  audit(db, actor, "integration.updated", "integration", provider, { status, missing });
  return row;
}

export function acceptWebhook(
  db: Database.Database,
  input: { provider: "shopify" | "woocommerce" | "razorpay"; rawBody: string; signature: string | null; eventId: string; businessId: string }
) {
  const integration = db.prepare(`SELECT * FROM integrations WHERE business_id = ? AND provider = ?`).get(input.businessId, input.provider) as
    | { id: string; business_id: string }
    | undefined;
  if (!integration) throw new AppError(404, "NOT_CONNECTED", "This business has not registered that integration");
  const secret =
    input.provider === "shopify"
      ? process.env.SHOPIFY_API_SECRET
      : input.provider === "woocommerce"
        ? process.env.WOOCOMMERCE_WEBHOOK_SECRET
        : process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new AppError(503, "NOT_CONFIGURED", "Webhook secret is not configured");
  const expected = input.provider === "razorpay" ? hmacHex(secret, input.rawBody) : hmacBase64(secret, input.rawBody);
  const valid = signaturesMatch(expected, input.signature);
  if (!valid) {
    db.prepare(
      `INSERT INTO webhook_events (id, integration_id, external_event_id, signature_valid, payload_json, status, error, created_at)
       VALUES (?, ?, ?, 0, ?, 'failed', 'invalid signature', ?)`
    ).run(crypto.randomUUID(), integration.id, `invalid:${input.eventId}:${crypto.randomUUID()}`, input.rawBody, nowIso());
    throw new AppError(401, "BAD_SIGNATURE", "Webhook signature did not match");
  }
  const existing = db
    .prepare(`SELECT id, status FROM webhook_events WHERE integration_id = ? AND external_event_id = ?`)
    .get(integration.id, input.eventId) as { id: string; status: string } | undefined;
  if (existing) return { duplicate: true, eventId: existing.id };
  const eventRowId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO webhook_events (id, integration_id, external_event_id, signature_valid, payload_json, status, error, created_at)
     VALUES (?, ?, ?, 1, ?, 'stored', NULL, ?)`
  ).run(eventRowId, integration.id, input.eventId, input.rawBody, nowIso());
  const jobId = crypto.randomUUID();
  db.prepare(`INSERT INTO sync_jobs (id, business_id, kind, payload_json, status, attempts, last_error, created_at) VALUES (?, ?, ?, ?, 'queued', 0, NULL, ?)`).run(
    jobId,
    input.businessId,
    `${input.provider}.webhook`,
    JSON.stringify({ eventRowId }),
    nowIso()
  );
  return { duplicate: false, eventId: eventRowId, jobId };
}

export function processQueuedJobs(db: Database.Database, actor: Actor) {
  const jobs = db
    .prepare(`SELECT * FROM sync_jobs WHERE business_id = ? AND status = 'queued' ORDER BY created_at`)
    .all(actor.businessId) as Array<{ id: string; kind: string; payload_json: string }>;
  const results = [];
  for (const job of jobs) {
    db.prepare(`UPDATE sync_jobs SET status = 'running', attempts = attempts + 1 WHERE id = ?`).run(job.id);
    try {
      const payload = JSON.parse(job.payload_json) as { eventRowId?: string };
      if (job.kind === "shopify.webhook" && payload.eventRowId) {
        const event = db.prepare(`SELECT * FROM webhook_events WHERE id = ?`).get(payload.eventRowId) as { payload_json: string } | undefined;
        if (!event) throw new AppError(404, "NOT_FOUND", "Webhook payload missing");
        const body = JSON.parse(event.payload_json) as Parameters<typeof parseShopifyOrder>[0] & { storeId?: string };
        const store = db.prepare(`SELECT id FROM ecommerce_stores WHERE business_id = ? AND provider = 'shopify'`).get(actor.businessId) as
          | { id: string }
          | undefined;
        if (!store) throw new AppError(409, "NO_STORE", "Shopify store row is missing");
        const normalized = parseShopifyOrder(body);
        normalized.storeId = store.id;
        const result = ingestOrder(db, actor, normalized);
        db.prepare(`UPDATE webhook_events SET status = 'processed' WHERE id = ?`).run(payload.eventRowId);
        db.prepare(`UPDATE sync_jobs SET status = 'succeeded' WHERE id = ?`).run(job.id);
        results.push({ jobId: job.id, result });
      } else {
        db.prepare(`UPDATE sync_jobs SET status = 'failed', last_error = ? WHERE id = ?`).run("unsupported job", job.id);
        results.push({ jobId: job.id, error: "unsupported job" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed";
      db.prepare(`UPDATE sync_jobs SET status = 'failed', last_error = ? WHERE id = ?`).run(message, job.id);
      results.push({ jobId: job.id, error: message });
    }
  }
  return results;
}
