export function buildUtm(url: string, source = "google", medium = "organic", campaign = "gbp") {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  parsed.searchParams.set("utm_source", source);
  parsed.searchParams.set("utm_medium", medium);
  parsed.searchParams.set("utm_campaign", campaign);
  return parsed.toString();
}
