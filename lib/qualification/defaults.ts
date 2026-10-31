import type { AnswerOption } from "@/lib/qualification/normalize";
import { defaultBudgetRanges, defaultServiceAreas } from "@/lib/qualification/normalize";

export type QuestionSeed = {
  field: string;
  position: number;
  optional: boolean;
  prompt: { en: string; hi: string; kn: string };
  options: AnswerOption[];
};

export const defaultQuestions: QuestionSeed[] = [
  {
    field: "project_scope",
    position: 1,
    optional: false,
    prompt: {
      en: "What would you like us to design?",
      hi: "आप क्या डिज़ाइन करवाना चाहते हैं?",
      kn: "ನೀವು ಏನನ್ನು ಡಿಸೈನ್ ಮಾಡಿಸಲು ಬಯಸುತ್ತೀರಿ?",
    },
    options: [
      { id: "full_home", title: "Full home" },
      { id: "kitchen", title: "Kitchen" },
      { id: "wardrobes", title: "Wardrobes" },
      { id: "living", title: "Living room" },
      { id: "office", title: "Office/commercial" },
      { id: "other", title: "Other" },
    ],
  },
  {
    field: "property_type",
    position: 2,
    optional: false,
    prompt: {
      en: "What type of property is it?",
      hi: "यह किस तरह की प्रॉपर्टी है?",
      kn: "ಇದು ಯಾವ ರೀತಿಯ ಆಸ್ತಿ?",
    },
    options: [
      { id: "apartment", title: "Apartment" },
      { id: "villa", title: "Villa/independent house" },
      { id: "office", title: "Office" },
      { id: "shop", title: "Shop/restaurant" },
      { id: "other", title: "Other" },
    ],
  },
  {
    field: "size",
    position: 3,
    optional: false,
    prompt: { en: "How big is it? For example, 2BHK or the area in sq ft.", hi: "यह कितना बड़ा है? जैसे 2BHK या वर्ग फुट।", kn: "ಇದು ಎಷ್ಟು ದೊಡ್ಡದು? ಉದಾಹರಣೆಗೆ 2BHK ಅಥವಾ ಚದರ ಅಡಿ." },
    options: [],
  },
  {
    field: "location",
    position: 4,
    optional: false,
    prompt: { en: "Which area is the property in?", hi: "प्रॉपर्टी किस इलाके में है?", kn: "ಆಸ್ತಿ ಯಾವ ಪ್ರದೇಶದಲ್ಲಿದೆ?" },
    options: [],
  },
  {
    field: "possession_status",
    position: 5,
    optional: false,
    prompt: { en: "Do you already have possession of the property?", hi: "क्या प्रॉपर्टी का कब्ज़ा मिल चुका है?", kn: "ಆಸ್ತಿಯ ಸ್ವಾಧೀನ ನಿಮಗೆ ಸಿಕ್ಕಿದೆಯೇ?" },
    options: [
      { id: "yes", title: "Yes" },
      { id: "soon", title: "Expected soon" },
      { id: "not_yet", title: "Not yet" },
    ],
  },
  {
    field: "timeline",
    position: 6,
    optional: false,
    prompt: { en: "When would you like to start?", hi: "आप कब शुरू करना चाहते हैं?", kn: "ನೀವು ಯಾವಾಗ ಆರಂಭಿಸಲು ಬಯಸುತ್ತೀರಿ?" },
    options: [
      { id: "within_month", title: "Within a month" },
      { id: "1_3", title: "1-3 months" },
      { id: "3_6", title: "3-6 months" },
      { id: "exploring", title: "Just exploring" },
    ],
  },
  {
    field: "budget_range",
    position: 7,
    optional: false,
    prompt: { en: "What budget range do you have in mind?", hi: "आपका बजट किस सीमा में है?", kn: "ನಿಮ್ಮ ಬಜೆಟ್ ಯಾವ ವ್ಯಾಪ್ತಿಯಲ್ಲಿದೆ?" },
    options: defaultBudgetRanges.map((range) => ({ id: range.id, title: range.title })),
  },
  {
    field: "decision_maker",
    position: 8,
    optional: true,
    prompt: { en: "Who else will be involved in the decision?", hi: "फैसले में और कौन शामिल होंगे?", kn: "ನಿರ್ಧಾರದಲ್ಲಿ ಬೇರೆ ಯಾರು ಇರುತ್ತಾರೆ?" },
    options: [],
  },
  {
    field: "style",
    position: 9,
    optional: true,
    prompt: { en: "Any style you like? You can describe it in words.", hi: "कोई पसंदीदा स्टाइल? शब्दों में बताइए।", kn: "ನಿಮಗೆ ಇಷ್ಟವಾದ ಶೈಲಿ ಇದೆಯೇ? ಮಾತಿನಲ್ಲಿ ಹೇಳಿ." },
    options: [],
  },
];

export const defaultAreas = defaultServiceAreas;

export const sequenceBlueprints = [
  { key: "arrival", name: "New lead", steps: [
    { offsetDays: 0, template: "intro", category: "utility" },
    { offsetDays: 1, template: "reminder", category: "utility" },
    { offsetDays: 3, template: "portfolio", category: "marketing" },
    { offsetDays: 7, template: "still_planning", category: "utility" },
    { offsetDays: 14, template: "final_check", category: "utility" },
  ]},
  { key: "partial", name: "Partially qualified", steps: [
    { offsetDays: 1, template: "reminder", category: "utility" },
    { offsetDays: 3, template: "portfolio", category: "marketing" },
    { offsetDays: 7, template: "still_planning", category: "utility" },
  ]},
  { key: "qualified_unbooked", name: "Qualified, no visit", steps: [
    { offsetDays: 1, template: "slot_reminder", category: "utility" },
    { offsetDays: 3, template: "still_planning", category: "utility" },
  ]},
  { key: "after_visit", name: "After site visit", steps: [
    { offsetDays: 0, template: "visit_thanks", category: "utility" },
    { offsetDays: 2, template: "quotation_timing", category: "utility" },
  ]},
  { key: "quotation", name: "Quotation sent", steps: [
    { offsetDays: 2, template: "quotation_followup", category: "utility" },
    { offsetDays: 5, template: "quotation_followup", category: "utility" },
    { offsetDays: 10, template: "final_check", category: "utility" },
  ]},
] as const;

export function fillTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
