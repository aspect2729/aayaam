export type BudgetRange = { id: string; title: string; minPaise: number; maxPaise: number | null };
export type ServiceArea = { name: string; aliases: string[] };
export type AnswerOption = { id: string; title: string };

export const defaultBudgetRanges: BudgetRange[] = [
  { id: "under_3", title: "Under 3L", minPaise: 0, maxPaise: 29_999_999 },
  { id: "3_8", title: "3-8L", minPaise: 30_000_000, maxPaise: 80_000_000 },
  { id: "8_15", title: "8-15L", minPaise: 80_000_001, maxPaise: 150_000_000 },
  { id: "15_30", title: "15-30L", minPaise: 150_000_001, maxPaise: 300_000_000 },
  { id: "30_plus", title: "30L+", minPaise: 300_000_001, maxPaise: null },
];

export const defaultServiceAreas: ServiceArea[] = [
  { name: "Jayanagar", aliases: ["jayanagar", "jaya nagar", "जय नगर", "जयनगर", "ಜಯನಗರ"] },
  { name: "JP Nagar", aliases: ["jp nagar", "j p nagar", "jayaprakash nagar"] },
  { name: "Indiranagar", aliases: ["indiranagar", "indira nagar"] },
  { name: "Koramangala", aliases: ["koramangala"] },
  { name: "HSR Layout", aliases: ["hsr", "hsr layout"] },
  { name: "Whitefield", aliases: ["whitefield"] },
  { name: "Hebbal", aliases: ["hebbal"] },
  { name: "Malleshwaram", aliases: ["malleshwaram", "malleswaram"] },
  { name: "Bengaluru", aliases: ["bengaluru", "bangalore", "बेंगलुरु", "ಬೆಂಗಳೂರು"] },
];

const lakhWords = "lakh|lakhs|lacs|lac|लाख|ಲಕ್ಷ";

export function parseMoneyPaise(text: string): number | null {
  const folded = text.toLowerCase().replace(/₹/g, " ").replace(/,/g, "");
  const crore = folded.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(crore|crores|cr|करोड़|ಕೋಟಿ)\\b`, "i"));
  if (crore) return Math.round(Number(crore[1]) * 10_000_000 * 100);
  const lakh = folded.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${lakhWords}|l)(?![a-z0-9])`, "i"));
  if (lakh) return Math.round(Number(lakh[1]) * 100_000 * 100);
  return null;
}

export function matchOption(text: string, options: AnswerOption[]) {
  const folded = text.trim().toLowerCase();
  const byId = options.find((option) => option.id.toLowerCase() === folded || option.title.toLowerCase() === folded);
  if (byId) return byId;
  const numbered = folded.match(/^(\d+)\s*$/);
  if (numbered) {
    const index = Number(numbered[1]) - 1;
    if (options[index]) return options[index];
  }
  return options.find((option) => folded.includes(option.title.toLowerCase()) || folded.includes(option.id.replaceAll("_", " "))) ?? null;
}

export function rangeForPaise(amount: number, ranges: BudgetRange[]) {
  return ranges.find((range) => amount >= range.minPaise && (range.maxPaise === null || amount <= range.maxPaise)) ?? null;
}

export function normalizeBudget(text: string, ranges: BudgetRange[]) {
  const option = matchOption(text, ranges.map((range) => ({ id: range.id, title: range.title })));
  if (option) {
    const range = ranges.find((item) => item.id === option.id)!;
    return { value: text.trim(), normalized: range.id, paise: range.minPaise, confidence: 0.95 };
  }
  const amount = parseMoneyPaise(text);
  if (amount === null) return { value: text.trim(), normalized: "", paise: null, confidence: 0.2 };
  const range = rangeForPaise(amount, ranges);
  if (!range) return { value: text.trim(), normalized: "", paise: amount, confidence: 0.4 };
  return { value: text.trim(), normalized: range.id, paise: amount, confidence: 0.9 };
}

export function normalizeSize(text: string) {
  const bhk = text.match(/(\d+)\s*-?\s*bhk/i) || text.match(/(\d+)\s*(?:बीएचके|ಬಿಎಚ್‌ಕೆ|ಬಿಎಚ್)/);
  const sqft = text.match(/(\d[\d,]*)\s*(?:sq\.?\s*ft|sqft|square\s*feet|sq\.?\s*feet|वर्ग\s*फुट|ಚದರ)/i);
  const bhkValue = bhk ? Number(bhk[1]) : null;
  const sqftValue = sqft ? Number(sqft[1].replace(/,/g, "")) : null;
  if (!bhkValue && !sqftValue) return { value: text.trim(), normalized: "", confidence: 0.2 };
  const parts = [bhkValue ? `${bhkValue}BHK` : null, sqftValue ? `${sqftValue} sq ft` : null].filter(Boolean);
  return { value: text.trim(), normalized: parts.join(", "), bhk: bhkValue, sqft: sqftValue, confidence: 0.92 };
}

export function normalizeLocality(text: string, areas: ServiceArea[]) {
  const folded = text.toLowerCase();
  const match = areas.find((area) => area.aliases.some((alias) => folded.includes(alias.toLowerCase())) || folded.includes(area.name.toLowerCase()));
  if (!match) return { value: text.trim(), normalized: "", confidence: 0.3 };
  return { value: text.trim(), normalized: match.name, confidence: 0.9 };
}

export function inServiceArea(normalized: string, areas: ServiceArea[]) {
  if (!normalized) return false;
  if (normalized === "Bengaluru") return true;
  return areas.some((area) => area.name === normalized);
}
