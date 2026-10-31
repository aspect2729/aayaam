import { seoConnections, type SeoConnectionSpec } from "@/lib/seo/connections";

export type SeoAdapterState = "awaiting_setup" | "keys_present_not_called" | "off";

function present(name: string) {
  return Boolean(process.env[name]?.trim());
}

function keysReady(spec: SeoConnectionSpec) {
  if (spec.flag === "FEATURE_KEYWORDS") {
    const ads = present("GOOGLE_ADS_DEVELOPER_TOKEN") && present("GOOGLE_ADS_CUSTOMER_ID");
    const dataForSeo = present("DATAFORSEO_LOGIN") && present("DATAFORSEO_PASSWORD");
    return ads || dataForSeo;
  }
  if (spec.flag === "FEATURE_RANK") {
    const dataForSeo = present("DATAFORSEO_LOGIN") && present("DATAFORSEO_PASSWORD");
    return dataForSeo || present("SERPAPI_API_KEY") || present("LOCAL_FALCON_API_KEY");
  }
  if (spec.flag === "FEATURE_BROWSER") {
    const worker = present("BROWSER_WORKER_URL") && present("BROWSER_WORKER_SECRET");
    return worker || present("BROWSERBASE_API_KEY");
  }
  if (spec.env.length === 0) return false;
  return spec.env.every(present);
}

export function adapterState(spec: SeoConnectionSpec): SeoAdapterState {
  const enabled = process.env[spec.flag] === "1" || process.env[spec.flag] === "true";
  if (spec.env.length === 0) return enabled ? "keys_present_not_called" : "awaiting_setup";
  if (!keysReady(spec)) return "awaiting_setup";
  if (!enabled) return "off";
  return "keys_present_not_called";
}

export function seoAdapterReport() {
  return seoConnections.map((spec) => ({
    api: spec.api,
    neededFor: spec.neededFor,
    env: spec.env,
    status: adapterState(spec),
    doc: spec.doc,
    callsNetwork: false as const,
  }));
}
