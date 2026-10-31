import { decidePolicy, type Proposal } from "@/lib/agents/policy";

const class4 = new Set(["name", "address", "phone", "primary_category", "service_area", "url", "redirect"]);

export function gbpFieldClass(field: string): 3 | 4 {
  return class4.has(field) ? 4 : 3;
}

export function decideSeoPolicy(
  proposal: Proposal & { field?: string },
  context: { quietHours?: boolean; optedOut?: boolean; text?: string; lastProfileChangeAt?: string | null; now?: Date } = {}
) {
  if (proposal.field && class4.has(proposal.field)) {
    const cool = context.lastProfileChangeAt
      ? new Date(context.now ?? Date.now()).getTime() - new Date(context.lastProfileChangeAt).getTime() < 7 * 24 * 60 * 60 * 1000
      : false;
    return {
      status: "awaiting_approval" as const,
      reason: cool
        ? "This is a high-impact profile edit, and another batch was already approved in the last seven days."
        : "Name, address, phone, primary category, service area, and URL changes need an explicit approval. Google may ask the business to verify again.",
    };
  }
  return decidePolicy(proposal, context);
}
