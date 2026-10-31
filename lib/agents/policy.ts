export type ActionClass = 1 | 2 | 3 | 4;

export type Proposal = {
  type: string;
  actionClass: ActionClass;
  payload: Record<string, unknown>;
  mode?: "approval" | "auto";
};

export type PolicyDecision = {
  status: "auto" | "awaiting_approval" | "rejected";
  reason: string;
};

const optOut = /\b(stop|unsubscribe|opt out|opt-out)\b/i;

export function decidePolicy(proposal: Proposal, context: { quietHours?: boolean; optedOut?: boolean; text?: string } = {}): PolicyDecision {
  if (context.optedOut || (context.text && optOut.test(context.text))) {
    return { status: "rejected", reason: "The person has opted out." };
  }
  if (proposal.actionClass === 4) return { status: "awaiting_approval", reason: "High-impact changes need an explicit approval." };
  if (proposal.actionClass <= 2) return { status: "auto", reason: "Read and internal updates stay inside Aayaam." };
  if (context.quietHours) return { status: "awaiting_approval", reason: "Quiet hours are in effect." };
  if (proposal.mode === "auto") return { status: "auto", reason: "A pre-authorised rule allows this message. It still needs a provider confirmation." };
  return { status: "awaiting_approval", reason: "Messages to customers need an approval or a pre-authorised rule." };
}
