export type Tier = "FAST" | "STANDARD" | "ESCALATION" | "EMBED";
export type ProviderName = "google" | "openai";

const defaults: Record<Tier, Record<ProviderName, string>> = {
  FAST: { google: "gemini-3.5-flash-lite", openai: "gpt-6-luna" },
  STANDARD: { google: "gemini-3.8-flash", openai: "gpt-5.4-mini" },
  ESCALATION: { google: "gemini-3.8-flash", openai: "gpt-6.1-sol" },
  EMBED: { google: "gemini-embedding-001", openai: "text-embedding-3-small" },
};

const envName: Record<Tier, Record<ProviderName, string>> = {
  FAST: { google: "AI_MODEL_FAST_GOOGLE", openai: "AI_MODEL_FAST_OPENAI" },
  STANDARD: { google: "AI_MODEL_STANDARD_GOOGLE", openai: "AI_MODEL_STANDARD_OPENAI" },
  ESCALATION: { google: "AI_MODEL_ESCALATION_GOOGLE", openai: "AI_MODEL_ESCALATION_OPENAI" },
  EMBED: { google: "AI_MODEL_EMBED_GOOGLE", openai: "AI_MODEL_EMBED_OPENAI" },
};

export function providerFor(slot: "primary" | "fallback"): ProviderName {
  const primary = process.env.AI_PRIMARY_PROVIDER === "openai" ? "openai" : "google";
  const fallback = process.env.AI_FALLBACK_PROVIDER === "google" ? "google" : "openai";
  return slot === "primary" ? primary : fallback;
}

export function resolveModelId(tier: Tier, slot: "primary" | "fallback") {
  const provider = providerFor(slot);
  const override = process.env[envName[tier][provider]]?.trim();
  return { provider, model: override || defaults[tier][provider] };
}

export function aiEnabled() {
  const flag = process.env.FEATURE_AI;
  return flag === "1" || flag === "true";
}

export function providerKey(provider: ProviderName) {
  if (provider === "google") return process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || "";
  return process.env.OPENAI_API_KEY?.trim() || "";
}
