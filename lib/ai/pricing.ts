export type ModelPrice = {
  model: string;
  provider: "google" | "openai";
  inputPerMtokUsd: number;
  cachedInputPerMtokUsd: number | null;
  outputPerMtokUsd: number;
  effectiveFrom: string;
  sourceUrl: string;
  note?: string;
};

/** Prices copied from the official pages on 31 Oct 2026. Standard tier, short context. */
export const modelPrices: ModelPrice[] = [
  {
    model: "gemini-3.5-flash-lite",
    provider: "google",
    inputPerMtokUsd: 0.3,
    cachedInputPerMtokUsd: 0.03,
    outputPerMtokUsd: 2.5,
    effectiveFrom: "2026-10-30",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/pricing",
  },
  {
    model: "gemini-3.8-flash",
    provider: "google",
    inputPerMtokUsd: 0.75,
    cachedInputPerMtokUsd: 0.075,
    outputPerMtokUsd: 3.75,
    effectiveFrom: "2026-10-30",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/pricing",
    note: "Through 31 Dec 2026. The same page lists $1.50 input and $7.50 output from 1 Jan 2027.",
  },
  {
    model: "gemini-embedding-001",
    provider: "google",
    inputPerMtokUsd: 0.15,
    cachedInputPerMtokUsd: null,
    outputPerMtokUsd: 0,
    effectiveFrom: "2026-10-30",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/pricing",
  },
  {
    model: "gpt-6-luna",
    provider: "openai",
    inputPerMtokUsd: 0.1,
    cachedInputPerMtokUsd: 0.01,
    outputPerMtokUsd: 0.5,
    effectiveFrom: "2026-10-31",
    sourceUrl: "https://developers.openai.com/api/docs/pricing",
    note: "Standard price under 272K context.",
  },
  {
    model: "gpt-5.4-mini",
    provider: "openai",
    inputPerMtokUsd: 0.75,
    cachedInputPerMtokUsd: 0.075,
    outputPerMtokUsd: 4.5,
    effectiveFrom: "2026-10-31",
    sourceUrl: "https://developers.openai.com/api/docs/pricing",
  },
  {
    model: "gpt-6.1-sol",
    provider: "openai",
    inputPerMtokUsd: 2,
    cachedInputPerMtokUsd: 0.1,
    outputPerMtokUsd: 10,
    effectiveFrom: "2026-10-31",
    sourceUrl: "https://developers.openai.com/api/docs/pricing",
    note: "Standard price under 272K context.",
  },
  {
    model: "text-embedding-3-small",
    provider: "openai",
    inputPerMtokUsd: 0.02,
    cachedInputPerMtokUsd: null,
    outputPerMtokUsd: 0,
    effectiveFrom: "2026-10-31",
    sourceUrl: "https://developers.openai.com/api/docs/pricing",
  },
];

export function estimateUsd(model: string, inputTokens: number, outputTokens: number, cachedInputTokens = 0) {
  const price = modelPrices.find((row) => row.model === model);
  if (!price) return null;
  const fresh = Math.max(0, inputTokens - cachedInputTokens);
  const cachedRate = price.cachedInputPerMtokUsd ?? price.inputPerMtokUsd;
  return (fresh * price.inputPerMtokUsd + cachedInputTokens * cachedRate + outputTokens * price.outputPerMtokUsd) / 1_000_000;
}
