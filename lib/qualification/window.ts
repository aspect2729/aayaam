import { WHATSAPP_SERVICE_WINDOW_MS } from "@/lib/qualification/limits";

export function windowExpiry(lastInboundAt: string | null) {
  if (!lastInboundAt) return null;
  return new Date(new Date(lastInboundAt).getTime() + WHATSAPP_SERVICE_WINDOW_MS).toISOString();
}

export function windowOpen(expiresAt: string | null, now: Date) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > now.getTime();
}

export function windowRemainingMs(expiresAt: string | null, now: Date) {
  if (!expiresAt) return 0;
  return Math.max(0, new Date(expiresAt).getTime() - now.getTime());
}

const statusRank: Record<string, number> = { queued: 0, awaiting_provider: 1, sent: 2, delivered: 3, read: 4, failed: 5, rejected: 5 };

export function nextDeliveryStatus(current: string, incoming: string) {
  if (current === "read" && incoming !== "failed") return current;
  if (current === "failed" || current === "rejected") return current;
  if ((statusRank[incoming] ?? 0) < (statusRank[current] ?? 0)) return current;
  return incoming;
}
