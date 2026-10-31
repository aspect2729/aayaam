import { checkBudget, costOf, recordSpend } from "@/lib/ai/cost";
import { aiEnabled, providerKey, resolveModelId, type Tier } from "@/lib/ai/models";
import { redactForLLM } from "@/lib/ai/redact";

export type CallOpts = {
  businessId: string;
  task: string;
  tier: Tier;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  promptVersion: string;
};

export type CallResult =
  | { ok: true; text: string; model: string; costUsd: number }
  | { ok: false; reason: "awaiting_setup" | "budget" | "provider_error"; message: string };

export async function callModel(options: CallOpts): Promise<CallResult> {
  if (!aiEnabled()) return { ok: false, reason: "awaiting_setup", message: "FEATURE_AI is off." };
  const primary = resolveModelId(options.tier, "primary");
  if (!providerKey(primary.provider)) return { ok: false, reason: "awaiting_setup", message: "The model key is missing." };
  try {
    checkBudget(options.businessId);
  } catch (error) {
    return { ok: false, reason: "budget", message: error instanceof Error ? error.message : "Budget exceeded" };
  }
  const prompt = redactForLLM(options.prompt);
  try {
    return await generate(options, primary.provider, primary.model, prompt);
  } catch {
    const fallback = resolveModelId(options.tier, "fallback");
    if (!providerKey(fallback.provider)) {
      return { ok: false, reason: "provider_error", message: "The primary model failed and the fallback key is missing." };
    }
    try {
      return await generate(options, fallback.provider, fallback.model, prompt);
    } catch (error) {
      return { ok: false, reason: "provider_error", message: error instanceof Error ? error.message : "The model call failed." };
    }
  }
}

async function generate(options: CallOpts, provider: "google" | "openai", modelId: string, prompt: string): Promise<CallResult> {
  const { generateText } = await import("ai");
  const model = await modelFor(provider, modelId);
  const result = await generateText({
    model,
    system: options.system,
    prompt,
    maxOutputTokens: options.maxOutputTokens ?? 400,
    temperature: options.tier === "STANDARD" ? 0.2 : 0,
  });
  const usage = result.usage;
  const input = usage?.inputTokens ?? 0;
  const output = usage?.outputTokens ?? 0;
  const costUsd = costOf(modelId, input, output);
  recordSpend(options.businessId, costUsd);
  return { ok: true, text: result.text, model: modelId, costUsd };
}

async function modelFor(provider: "google" | "openai", modelId: string) {
  if (provider === "google") {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    return createGoogleGenerativeAI({ apiKey: providerKey("google") })(modelId);
  }
  const { createOpenAI } = await import("@ai-sdk/openai");
  return createOpenAI({ apiKey: providerKey("openai") })(modelId);
}
