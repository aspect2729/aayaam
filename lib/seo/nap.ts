export function toE164In(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  const bare = digits.startsWith("+") ? digits.slice(1) : digits;
  if (/^[6-9]\d{9}$/.test(bare)) return `+91${bare}`;
  if (/^91[6-9]\d{9}$/.test(bare)) return `+${bare}`;
  return null;
}

export function normaliseName(name: string) {
  return name.trim().toLowerCase().split(/\s+/).join(" ");
}

export function normaliseAddress(address: string) {
  return address
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

export function compareNap(
  canonical: { name: string; address: string; phone: string },
  found: { name: string; address: string; phone: string }
) {
  const mismatches: string[] = [];
  if (normaliseName(canonical.name) !== normaliseName(found.name)) mismatches.push("name");
  if (normaliseAddress(canonical.address) !== normaliseAddress(found.address)) mismatches.push("address");
  const left = toE164In(canonical.phone);
  const right = toE164In(found.phone);
  if (!left || !right || left !== right) mismatches.push("phone");
  const matched = 3 - mismatches.length;
  return { score: Math.round((matched / 3) * 100), mismatches };
}
