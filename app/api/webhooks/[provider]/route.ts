import { getDb } from "@/server/db";
import { errorResponse, json } from "@/server/http";
import { acceptWebhook } from "@/server/integrations";
import { acceptEmailWebhook, acceptWhatsAppWebhook } from "@/server/outreach/webhooks";
import { liveProviders } from "@/server/outreach/providers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/whatsapp") || url.searchParams.get("hub.mode")) {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return json({ error: { code: "FORBIDDEN", message: "Webhook verification failed" } }, 403);
  }
  return json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
}

export async function POST(request: Request, context: { params: { provider: string } }) {
  try {
    const provider = context.params.provider;
    const businessId = new URL(request.url).searchParams.get("businessId");
    if (!businessId) return json({ error: { code: "INVALID_INPUT", message: "businessId query parameter is required" } }, 422);
    const rawBody = await request.text();
    if (provider === "whatsapp") {
      const result = acceptWhatsAppWebhook(getDb(), businessId, rawBody, request.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET, liveProviders());
      return json(result.body, result.status);
    }
    if (provider === "email") {
      const result = acceptEmailWebhook(
        getDb(),
        businessId,
        rawBody,
        {
          hmac: request.headers.get("x-aayaam-email-signature"),
          id: request.headers.get("svix-id"),
          timestamp: request.headers.get("svix-timestamp"),
          signature: request.headers.get("svix-signature"),
        },
        process.env.EMAIL_WEBHOOK_SECRET,
        liveProviders()
      );
      return json(result.body, result.status);
    }
    if (provider !== "shopify" && provider !== "woocommerce" && provider !== "razorpay") {
      return json({ error: { code: "UNKNOWN_PROVIDER", message: "Unsupported webhook provider" } }, 404);
    }
    const signature =
      request.headers.get("x-shopify-hmac-sha256") ||
      request.headers.get("x-wc-webhook-signature") ||
      request.headers.get("x-razorpay-signature");
    const eventId = request.headers.get("x-event-id") || request.headers.get("x-shopify-webhook-id") || request.headers.get("x-razorpay-event-id");
    if (!eventId) return json({ error: { code: "INVALID_INPUT", message: "An event id header is required" } }, 422);
    const result = acceptWebhook(getDb(), { provider, rawBody, signature, eventId, businessId });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
