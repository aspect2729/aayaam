import { createHmac, timingSafeEqual } from "crypto";

export type OutboundMessage = {
  to: string;
  body: string;
  templateName?: string;
  language: "en" | "hi" | "kn";
  category: "utility" | "marketing" | "service";
  buttons?: { id: string; title: string }[];
  list?: { id: string; title: string }[];
};

export type SendResult = {
  status: "sent" | "awaiting_provider" | "failed";
  providerMessageId?: string;
  reason: string;
  costCategory: "utility" | "marketing" | "service" | "unknown";
};

export interface MessagingProvider {
  channel: "whatsapp" | "email";
  mode: "test" | "live";
  health(): { state: "not_connected" | "credentials_present" | "test"; detail: string };
  send(message: OutboundMessage): SendResult;
}

function liveWhatsApp(): MessagingProvider {
  const present = Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  return {
    channel: "whatsapp",
    mode: "live",
    health: () => ({
      state: present ? "credentials_present" : "not_connected",
      detail: present
        ? "A token is stored. No message was sent to Meta. Template approval is still not synced."
        : "WhatsApp is not connected. Automated sequences do not use wa.me.",
    }),
    send: (message) => ({
      status: "awaiting_provider",
      reason: "WhatsApp did not confirm delivery. No request was made to Meta.",
      costCategory: message.category,
    }),
  };
}

function liveEmail(): MessagingProvider {
  const present = Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_FROM_DOMAIN);
  return {
    channel: "email",
    mode: "live",
    health: () => ({
      state: present ? "credentials_present" : "not_connected",
      detail: present
        ? "Email settings are present. SPF, DKIM, and DMARC were not checked, and no email was sent."
        : "Email is not connected. Domain checks are not verified.",
    }),
    send: (message) => ({
      status: "awaiting_provider",
      reason: "Email was not handed to Resend or SES. No message was sent.",
      costCategory: message.category,
    }),
  };
}

export type ProviderSet = { whatsapp: MessagingProvider; email: MessagingProvider };

export function liveProviders(): ProviderSet {
  return { whatsapp: liveWhatsApp(), email: liveEmail() };
}

export function testProviders(): ProviderSet {
  const make = (channel: "whatsapp" | "email"): MessagingProvider => ({
    channel,
    mode: "test",
    health: () => ({ state: "test", detail: "Test mode confirms an id without calling a provider." }),
    send: (message) => ({
      status: "sent",
      providerMessageId: `test-${channel}-${crypto.randomUUID()}`,
      reason: "Test mode provider confirmed this id.",
      costCategory: message.category,
    }),
  });
  return { whatsapp: make("whatsapp"), email: make("email") };
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyMetaSignature(rawBody: string, header: string | null, secret: string | undefined) {
  if (!header || !secret) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return safeEqual(expected, header);
}

export function verifyEmailHmac(rawBody: string, header: string | null, secret: string | undefined) {
  if (!header || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, header);
}

export function verifySvix(rawBody: string, id: string | null, timestamp: string | null, signature: string | null, secret: string | undefined) {
  if (!id || !timestamp || !signature || !secret?.startsWith("whsec_")) return false;
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const digest = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    return version === "v1" && !!value && safeEqual(value, digest);
  });
}
