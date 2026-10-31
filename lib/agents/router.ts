export type AgentKey = "crm_whatsapp" | "lead_intake" | "sales" | "marketing_seo" | "commerce" | "finance" | "operations" | "business_brain";

const rules: Record<string, AgentKey[]> = {
  "member.created": ["crm_whatsapp"],
  "member.payment_due": ["crm_whatsapp"],
  "payment.recorded": ["crm_whatsapp", "finance"],
  "lead.received": ["lead_intake"],
  "lead.created": ["sales", "business_brain"],
  "message.inbound": ["sales", "crm_whatsapp"],
  "review.received": ["marketing_seo"],
  "gbp.post_due": ["marketing_seo"],
  "seo.week_due": ["marketing_seo"],
  "order.stuck": ["commerce", "operations"],
  "stock.low": ["commerce"],
  "task.due": ["operations"],
};

export function routeEvent(type: string): AgentKey[] {
  return rules[type] ?? ["business_brain"];
}

export function ruleProposal(agent: AgentKey, type: string) {
  if (agent === "crm_whatsapp" && type === "member.payment_due") {
    return { type: "whatsapp.send", actionClass: 3 as const, payload: { template: "payment_reminder", note: "Amount comes from the ledger, not the model." } };
  }
  if (agent === "crm_whatsapp" && type === "member.created") {
    return { type: "whatsapp.send", actionClass: 3 as const, payload: { template: "welcome" } };
  }
  if (agent === "crm_whatsapp" && type === "payment.recorded") {
    return { type: "whatsapp.send", actionClass: 3 as const, payload: { template: "receipt", note: "Receipt link only. Not a bank settlement." } };
  }
  if (agent === "lead_intake" && type === "lead.received") {
    return { type: "lead.normalize", actionClass: 2 as const, payload: { step: "phone, email, source" } };
  }
  if (agent === "sales" && type === "lead.created") {
    return { type: "sequence.enroll", actionClass: 2 as const, payload: { sequence: "qualification" } };
  }
  if (agent === "marketing_seo" && type === "gbp.post_due") {
    return { type: "gbp.post.propose", actionClass: 3 as const, payload: { cadenceDays: 3 } };
  }
  if (agent === "marketing_seo" && type === "review.received") {
    return { type: "gbp.review_reply.propose", actionClass: 3 as const, payload: { note: "A public reply stays a draft until it is approved." } };
  }
  if (agent === "marketing_seo" && type === "seo.week_due") {
    return { type: "seo.plan.update", actionClass: 2 as const, payload: { schedule: "Monday 07:00 Asia/Kolkata" } };
  }
  if (agent === "commerce" && type === "stock.low") {
    return { type: "reorder.propose", actionClass: 3 as const, payload: {} };
  }
  if (agent === "finance") {
    return { type: "finance.summary", actionClass: 1 as const, payload: { source: "ledger" } };
  }
  if (agent === "operations") {
    return { type: "task.create", actionClass: 2 as const, payload: {} };
  }
  return { type: "insight.phrase", actionClass: 1 as const, payload: { source: "rules" } };
}
