import { decidePolicy, type Proposal } from "@/lib/agents/policy";
import { ruleProposal, routeEvent, type AgentKey } from "@/lib/agents/router";

export type RunRecord = {
  runKey: string;
  agent: AgentKey;
  status: "completed" | "waiting_approval" | "rejected";
  actionStatus: "proposed" | "awaiting_approval" | "rejected" | "awaiting_provider";
  reason: string;
};

const seen = new Set<string>();

export function resetRunsForTests() {
  seen.clear();
}

export function runEvent(input: { eventId: string; type: string; text?: string; optedOut?: boolean; providerConnected?: boolean }): RunRecord[] {
  return routeEvent(input.type).map((agent) => {
    const runKey = `${agent}:${input.eventId}`;
    if (seen.has(runKey)) {
      return { runKey, agent, status: "completed" as const, actionStatus: "proposed" as const, reason: "Duplicate event ignored." };
    }
    seen.add(runKey);
    const proposal = ruleProposal(agent, input.type) as Proposal;
    const decision = decidePolicy(proposal, { text: input.text, optedOut: input.optedOut });
    if (decision.status === "rejected") {
      return { runKey, agent, status: "rejected", actionStatus: "rejected", reason: decision.reason };
    }
    if (decision.status === "awaiting_approval") {
      return { runKey, agent, status: "waiting_approval", actionStatus: "awaiting_approval", reason: decision.reason };
    }
    if (proposal.actionClass === 3 && !input.providerConnected) {
      return { runKey, agent, status: "completed", actionStatus: "awaiting_provider", reason: "The rule is allowed. The provider has not confirmed a send." };
    }
    return { runKey, agent, status: "completed", actionStatus: "proposed", reason: decision.reason };
  });
}
