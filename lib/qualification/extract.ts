import { z } from "zod";
import { detectLanguage, isPromptInjection } from "@/lib/qualification/language";
import { matchOption, normalizeBudget, normalizeLocality, normalizeSize, type AnswerOption, type BudgetRange, type ServiceArea } from "@/lib/qualification/normalize";

export const extractionSchema = z.object({
  field: z.string(),
  value: z.string(),
  normalized_value: z.string(),
  confidence: z.number().min(0).max(1),
  evidence_message_id: z.string().nullable(),
});

export type Extraction = z.infer<typeof extractionSchema>;

export type QuestionField =
  | "project_scope"
  | "property_type"
  | "size"
  | "location"
  | "possession_status"
  | "timeline"
  | "budget_range"
  | "decision_maker"
  | "style";

const keywordGroups: Record<string, { id: string; words: string[] }[]> = {
  project_scope: [
    { id: "full_home", words: ["full home", "entire home", "whole home", "पूरा घर", "ಪೂರ್ತಿ ಮನೆ", "ಮನೆ"] },
    { id: "kitchen", words: ["kitchen", "किचन", "रसोई", "ಕಿಚನ್"] },
    { id: "wardrobes", words: ["wardrobe", "wardrobes", "अलमारी", "ವಾರ್ಡ್ರೋಬ್"] },
    { id: "living", words: ["living room", "hall", "ड्राइंग", "लिविंग", "ಹಾಲ್"] },
    { id: "office", words: ["office", "commercial", "ऑफिस", "ಕಚೇರಿ"] },
    { id: "other", words: ["other", "something else", "अन्य", "ಇತರೆ"] },
  ],
  property_type: [
    { id: "apartment", words: ["apartment", "flat", "अपार्टमेंट", "फ्लैट", "ಅಪಾರ್ಟ್ಮೆಂಟ್", "ಫ್ಲಾಟ್"] },
    { id: "villa", words: ["villa", "independent", "house", "विला", "ಮನೆ", "ವಿಲ್ಲಾ"] },
    { id: "office", words: ["office", "ऑफिस", "ಕಚೇರಿ"] },
    { id: "shop", words: ["shop", "restaurant", "दुकान", "ಅಂಗಡಿ"] },
    { id: "other", words: ["other", "अन्य", "ಇತರೆ"] },
  ],
  possession_status: [
    { id: "yes", words: ["yes", "already", "possession", "हाँ", "हा", "ಹೌದು", "ಇದೆ"] },
    { id: "soon", words: ["soon", "expected", "जल्दी", "ಶೀಘ್ರ"] },
    { id: "not_yet", words: ["not yet", "अभी नहीं", "ಇನ್ನೂ ಇಲ್ಲ"] },
  ],
  timeline: [
    { id: "within_month", words: ["within a month", "this month", "immediately", "एक महीने", "ತಿಂಗಳೊಳಗೆ"] },
    { id: "1_3", words: ["1-3", "1–3", "three months", "1 से 3", "ಮೂರು ತಿಂಗಳ"] },
    { id: "3_6", words: ["3-6", "3–6", "six months", "6 महीने"] },
    { id: "exploring", words: ["exploring", "just looking", "not sure", "देख रहे", "ನೋಡ್ತಾ ಇದ್ದೇವೆ"] },
  ],
};

function fromKeywords(text: string, field: string, options: AnswerOption[]) {
  const groups = keywordGroups[field] ?? [];
  const folded = text.toLowerCase();
  const hit = groups.find((group) => group.words.some((word) => folded.includes(word.toLowerCase())));
  if (!hit) return null;
  return options.find((option) => option.id === hit.id) ?? null;
}

export function extractAnswer(input: {
  field: QuestionField | string;
  text: string;
  options: AnswerOption[];
  ranges: BudgetRange[];
  areas: ServiceArea[];
  evidenceMessageId: string | null;
}): Extraction {
  const text = input.text.trim();
  if (!text || isPromptInjection(text)) {
    return extractionSchema.parse({
      field: input.field,
      value: text,
      normalized_value: "",
      confidence: 0,
      evidence_message_id: input.evidenceMessageId,
    });
  }
  const option = matchOption(text, input.options) ?? fromKeywords(text, input.field, input.options);
  if (input.field === "budget_range") {
    const budget = normalizeBudget(text, input.ranges);
    return extractionSchema.parse({
      field: input.field,
      value: budget.value,
      normalized_value: budget.normalized,
      confidence: budget.confidence,
      evidence_message_id: input.evidenceMessageId,
    });
  }
  if (input.field === "size") {
    const size = normalizeSize(text);
    return extractionSchema.parse({
      field: input.field,
      value: size.value,
      normalized_value: size.normalized,
      confidence: size.confidence,
      evidence_message_id: input.evidenceMessageId,
    });
  }
  if (input.field === "location") {
    const place = normalizeLocality(text, input.areas);
    return extractionSchema.parse({
      field: input.field,
      value: place.value,
      normalized_value: place.normalized,
      confidence: place.confidence,
      evidence_message_id: input.evidenceMessageId,
    });
  }
  if (input.field === "decision_maker" || input.field === "style") {
    return extractionSchema.parse({
      field: input.field,
      value: text,
      normalized_value: text.slice(0, 160),
      confidence: text.length > 1 ? 0.8 : 0.2,
      evidence_message_id: input.evidenceMessageId,
    });
  }
  if (option) {
    return extractionSchema.parse({
      field: input.field,
      value: text,
      normalized_value: option.id,
      confidence: 0.95,
      evidence_message_id: input.evidenceMessageId,
    });
  }
  return extractionSchema.parse({
    field: input.field,
    value: text,
    normalized_value: "",
    confidence: 0.25,
    evidence_message_id: input.evidenceMessageId,
  });
}

export function languageOf(text: string) {
  return detectLanguage(text);
}
