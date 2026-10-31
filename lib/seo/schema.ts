const allowedTypes = new Set([
  "LocalBusiness",
  "HealthClub",
  "ExerciseGym",
  "HomeAndConstructionBusiness",
  "Store",
  "BeautySalon",
  "Dentist",
  "MedicalBusiness",
  "ProfessionalService",
]);

export function validateJsonLd(raw: string, options: { allowReview?: boolean } = {}) {
  const reasons: string[] = [];
  if (/<script/i.test(raw)) reasons.push("Schema must be JSON, not a script tag.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reasons: [...reasons, "The schema is not valid JSON."] };
  }
  const record = parsed as { "@type"?: string | string[]; name?: string; address?: unknown };
  const type = Array.isArray(record["@type"]) ? record["@type"][0] : record["@type"];
  if (type === "Review" && !options.allowReview) reasons.push("Review markup is not proposed from this draft.");
  if (!type || (type !== "Review" && !allowedTypes.has(type))) reasons.push("The type must be a LocalBusiness subtype from the allowed list.");
  if (!record.name) reasons.push("A business name is required.");
  if (!record.address) reasons.push("An address is required.");
  if (type === "Review" && !options.allowReview) reasons.push("Review markup is not proposed from this draft.");
  return { ok: reasons.length === 0, reasons };
}
