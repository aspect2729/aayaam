const phone = /(?:\+91[\s-]?)?[6-9]\d{9}/g;
const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const gstin = /\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]/gi;

export function redactForLLM(text: string) {
  return text.replace(gstin, "[gstin]").replace(email, "[email]").replace(phone, "[phone]");
}
