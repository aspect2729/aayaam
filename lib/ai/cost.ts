import { estimateUsd } from "@/lib/ai/pricing";

export class BudgetExceeded extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceeded";
  }
}

type Spend = { usd: number; day: string };

const spend = new Map<string, Spend>();

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function resetSpendForTests() {
  spend.clear();
}

export function recordSpend(businessId: string, usd: number) {
  const day = today();
  const current = spend.get(businessId);
  if (!current || current.day !== day) spend.set(businessId, { usd, day });
  else current.usd += usd;
  return spend.get(businessId)?.usd ?? usd;
}

export function checkBudget(businessId: string) {
  const global = Number(process.env.AI_GLOBAL_DAILY_BUDGET_USD || "");
  const used = spend.get(businessId);
  const day = today();
  const usd = used && used.day === day ? used.usd : 0;
  if (Number.isFinite(global) && global > 0 && usd >= global) {
    throw new BudgetExceeded("The daily AI budget is used. Drafts stay on templates.");
  }
  const rate = Number(process.env.AI_USD_INR_RATE || "");
  const limit = Number(process.env.AI_MONTHLY_BUDGET_INR_DEFAULT || "");
  if (Number.isFinite(rate) && rate > 0 && Number.isFinite(limit) && limit > 0 && usd * rate >= limit) {
    throw new BudgetExceeded("The monthly AI budget is used. Rule reminders still run.");
  }
  return { usd, inrEnforced: Number.isFinite(rate) && rate > 0 };
}

export function costOf(model: string, inputTokens: number, outputTokens: number) {
  return estimateUsd(model, inputTokens, outputTokens) ?? 0;
}
