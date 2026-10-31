import type { ScoreInput } from "@/lib/lead-score";
import { scoreLead } from "@/lib/lead-score";
import { defaultBudgetRanges, type BudgetRange } from "@/lib/qualification/normalize";

export type StopInput = {
  optedOut: boolean;
  booked: boolean;
  manualStage: boolean;
  stage: string;
  humanActive: boolean;
  consentWithdrawn: boolean;
  channelDead: boolean;
  archived: boolean;
  repliedSinceSchedule: boolean;
};

export function stopReason(input: StopInput) {
  if (input.optedOut) return "opted_out";
  if (input.archived) return "archived";
  if (input.booked) return "booked";
  if (input.manualStage) return "stage_changed";
  if (input.humanActive) return "human_takeover";
  if (input.consentWithdrawn) return "consent_withdrawn";
  if (input.channelDead) return "channel_failed";
  if (["won", "lost", "not_a_fit", "cold", "opted_out"].includes(input.stage)) return input.stage;
  if (input.repliedSinceSchedule) return "replied";
  return null;
}

const timelineMap: Record<string, ScoreInput["timeline"]> = {
  within_month: "immediate",
  "1_3": "1_3_months",
  "3_6": "3_6_months",
  exploring: "later",
};

export function scoreFromAnswers(answers: Record<string, string>, hasPhone: boolean, ranges: BudgetRange[] = defaultBudgetRanges) {
  const range = ranges.find((item) => item.id === answers.budget_range);
  return scoreLead({
    budgetPaise: range ? range.minPaise : null,
    timeline: timelineMap[answers.timeline] ?? null,
    projectType: answers.project_scope || null,
    hasPhone,
    hasRequirement: Boolean(answers.project_scope || answers.size),
    daysSinceContact: 0,
  });
}

export type Outcome = "continue" | "qualified" | "not_a_fit" | "needs_review";

export function decideOutcome(input: {
  answers: Record<string, { normalized: string; verified: boolean }>;
  required: string[];
  minBudgetPaise: number;
  ranges: BudgetRange[];
  locationServed: boolean;
  locationKnown: boolean;
}) {
  const budgetId = input.answers.budget_range?.normalized;
  const range = input.ranges.find((item) => item.id === budgetId);
  if (range && range.maxPaise !== null && range.maxPaise < input.minBudgetPaise) return "not_a_fit" as Outcome;
  if (input.locationKnown && !input.locationServed) return "not_a_fit" as Outcome;
  const pending = input.required.some((field) => !input.answers[field]);
  if (pending) return "continue" as Outcome;
  const unverified = input.required.some((field) => input.answers[field] && !input.answers[field].verified);
  if (unverified || input.answers.timeline?.normalized === "exploring" || input.answers.possession_status?.normalized === "not_yet") return "needs_review" as Outcome;
  return "qualified" as Outcome;
}
