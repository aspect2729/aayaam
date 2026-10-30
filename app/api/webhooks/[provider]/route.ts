import { getDb } from "@/server/db";
import { errorResponse, json } from "@/server/http";
import { acceptWebhook } from "@/server/integrations";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: { provider: string } }) {
  try {
    const provider = context.params.provider;
    if (provider !== "shopify" && provider !== "woocommerce" && provider !== "razorpay") {
      return json({ error: { code: "UNKNOWN_PROVIDER", message: "Unsupported webhook provider" } }, 404);
    }
    const businessId = new URL(request.url).searchParams.get("businessId");
    if (!businessId) return json({ error: { code: "INVALID_INPUT", message: "businessId query parameter is required" } }, 422);
    const rawBody = await request.text();
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
