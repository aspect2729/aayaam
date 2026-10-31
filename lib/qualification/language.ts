export type LeadLanguage = "en" | "hi" | "kn";

export function detectLanguage(text: string): LeadLanguage {
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  return "en";
}

const optOutPhrases = [
  "unsubscribe",
  "opt out",
  "opt-out",
  "don't message",
  "dont message",
  "do not message",
  "stop messaging",
  "band karo",
  "bandh karo",
  "message mat",
  "msg mat",
  "बंद करो",
  "मैसेज मत",
  "संदेश बंद",
  "ನಿಲ್ಲಿಸಿ",
  "ಮೆಸೇಜ್ ಬೇಡ",
  "ಬೇಡ",
];

export function isOptOut(text: string) {
  const folded = text.trim().toLowerCase();
  if (/^\s*stop[.!]?\s*$/i.test(text) || /\bstop\b/i.test(text)) return true;
  return optOutPhrases.some((phrase) => folded.includes(phrase.toLowerCase()));
}

export function asksForPrice(text: string) {
  return /how much|what(?:'s| is)? (?:the )?(?:price|cost|charge|rate)|discount|quotation|quote|estimate|कितना लगेगा|क्या रेट|कीमत|ಎಷ್ಟು ಆಗುತ್ತ|ಡಿಸ್ಕೌಂಟ್|ಬೆಲೆ ಎಷ್ಟು/i.test(text);
}

export function needsHumanTone(text: string) {
  return /angry|complaint|fraud|cheat|worst|police|lawyer|बेकार|धोखा|शिकायत|ದೂರು|ಮೋಸ/i.test(text);
}

export function isPromptInjection(text: string) {
  return /ignore (all |previous |your )?instructions|you are now|system prompt|reveal your (prompt|rules)|developer mode/i.test(text);
}

export function mentionsSensitiveData(text: string) {
  return /aadhaar|aadhar|pan card|\b\d{4}\s?\d{4}\s?\d{4}\b/i.test(text);
}
