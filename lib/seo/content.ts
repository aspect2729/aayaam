const prohibited = [/guaranteed ranking/i, /we guarantee/i, /#1 on google/i, /number one on google/i, /cure[sd]? /i];
const phone = /(?:\+91[\s-]?)?[6-9]\d{9}/;
const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const price = /₹\s?[\d,]+/g;

function words(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u0900-\u097f\u0c80-\u0cff]+/)
    .filter((word) => word.length > 2);
}

export function similar(left: string, right: string) {
  const a = new Set(words(left));
  const b = new Set(words(right));
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export function checkDraft(input: {
  text: string;
  previous?: string[];
  servedLocalities: string[];
  ownerPrices?: string[];
  mentionedLocalities?: string[];
}) {
  const reasons: string[] = [];
  if (input.text.length > 1500) reasons.push("The draft is longer than 1,500 characters.");
  if (input.previous?.some((post) => similar(input.text, post) >= 0.8)) reasons.push("The draft repeats a recent post.");
  const tokens = words(input.text);
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  for (const [token, count] of counts) {
    if (count >= 4 && count / Math.max(tokens.length, 1) > 0.08) reasons.push(`The word “${token}” is repeated enough to look stuffed.`);
  }
  if (prohibited.some((pattern) => pattern.test(input.text))) reasons.push("The draft makes a prohibited claim.");
  for (const locality of input.mentionedLocalities ?? []) {
    if (!input.servedLocalities.some((served) => served.toLowerCase() === locality.toLowerCase())) {
      reasons.push(`${locality} is not a locality this business serves.`);
    }
  }
  const amounts = input.text.match(price) ?? [];
  for (const amount of amounts) {
    const allowed = (input.ownerPrices ?? []).some((priceText) => amount.replace(/\s/g, "") === priceText.replace(/\s/g, ""));
    if (!allowed) reasons.push("A price appears that the owner did not enter.");
  }
  return { ok: reasons.length === 0, reasons };
}

export function checkReviewReply(text: string) {
  const reasons: string[] = [];
  if (prohibited.some((pattern) => pattern.test(text))) reasons.push("The reply makes a prohibited claim.");
  if (phone.test(text)) reasons.push("A public reply must not include a phone number.");
  if (email.test(text)) reasons.push("A public reply must not include an email address.");
  return { ok: reasons.length === 0, reasons };
}
