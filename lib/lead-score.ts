export type ScoreInput = {
  budgetPaise: number | null;
  timeline: "immediate" | "1_3_months" | "3_6_months" | "later" | null;
  projectType: string | null;
  hasPhone: boolean;
  hasRequirement: boolean;
  daysSinceContact: number | null;
};

export type ScoreResult = { score: number; reasons: string[] };

export function scoreLead(input: ScoreInput): ScoreResult {
  let score = 0;
  const reasons: string[] = [];
  if (input.budgetPaise !== null && input.budgetPaise >= 80000000) {
    score += 20;
    reasons.push("+20 budget above ₹8,00,000");
  } else if (input.budgetPaise !== null && input.budgetPaise >= 30000000) {
    score += 10;
    reasons.push("+10 budget above ₹3,00,000");
  }
  if (input.timeline === "immediate") {
    score += 15;
    reasons.push("+15 wants to start immediately");
  } else if (input.timeline === "1_3_months") {
    score += 10;
    reasons.push("+10 wants to start within 3 months");
  }
  if (input.projectType) {
    score += 10;
    reasons.push("+10 project type is known");
  }
  if (input.hasPhone) {
    score += 15;
    reasons.push("+15 phone number is present");
  }
  if (input.hasRequirement) {
    score += 10;
    reasons.push("+10 requirements are written");
  }
  if (input.daysSinceContact !== null && input.daysSinceContact <= 2) {
    score += 15;
    reasons.push("+15 contacted within 2 days");
  } else if (input.daysSinceContact !== null && input.daysSinceContact > 7) {
    score -= 10;
    reasons.push("-10 no contact for more than 7 days");
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}
