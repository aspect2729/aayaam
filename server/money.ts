/** Integer paise. 100 paise = ₹1. Never use binary floating point for money. */

export function assertPaise(value: number, label = "amount"): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer number of paise`);
  }
  return value;
}

export function mulDivRound(amount: number, numerator: number, denominator: number): number {
  assertPaise(amount, "amount");
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
    throw new Error("mulDivRound requires integer numerator and positive denominator");
  }
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const product = abs * numerator;
  if (!Number.isSafeInteger(product)) {
    throw new Error("monetary product exceeds safe integer range");
  }
  const rounded = Math.floor((product + Math.floor(denominator / 2)) / denominator);
  return negative ? -rounded : rounded;
}

export function taxPaise(taxablePaise: number, taxBps: number): number {
  if (taxablePaise < 0) throw new Error("taxable amount cannot be negative");
  if (!Number.isInteger(taxBps) || taxBps < 0 || taxBps > 10000) {
    throw new Error("tax basis points must be between 0 and 10000");
  }
  return mulDivRound(taxablePaise, taxBps, 10000);
}

export function linePaise(quantityMilli: number, unitPaise: number): number {
  if (!Number.isInteger(quantityMilli) || quantityMilli < 0) {
    throw new Error("quantity must be a non-negative milli-unit integer");
  }
  if (!Number.isInteger(unitPaise) || unitPaise < 0) {
    throw new Error("unit price must be a non-negative paise integer");
  }
  return mulDivRound(quantityMilli * unitPaise, 1, 1000);
}

/** Accepts a decimal string with at most `scale` fraction digits. Rejects binary floats passed as numbers. */
export function decimalToScaled(value: string, scale: number): number {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`invalid decimal amount: ${value}`);
  }
  const negative = trimmed.startsWith("-");
  const [whole, fraction = ""] = trimmed.replace("-", "").split(".");
  if (fraction.length > scale) {
    throw new Error(`more than ${scale} decimal places: ${value}`);
  }
  const digits = `${whole}${fraction.padEnd(scale, "0")}`;
  const scaled = Number(digits);
  if (!Number.isSafeInteger(scaled)) throw new Error("decimal is too large");
  return negative ? -scaled : scaled;
}

export function decimalToPaise(value: string): number {
  return decimalToScaled(value, 2);
}

export function decimalToMilli(value: string): number {
  return decimalToScaled(value, 3);
}

export function formatInr(paise: number): string {
  assertPaise(paise);
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  const grouped = new Intl.NumberFormat("en-IN").format(rupees);
  return `${negative ? "-" : ""}₹${grouped}.${fraction}`;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
