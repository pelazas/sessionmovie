/**
 * Per-model API list prices, USD per MILLION tokens. This is DATA, not code:
 * update the table, nothing else.
 *
 * Source: https://platform.claude.com/docs/en/about-claude/pricing
 * (standard tier, checked 2026-07-04). Cache reads are 90% off input;
 * cache writes (5m ephemeral) are 1.25× input.
 *
 * Unknown models get NO estimate — a missing cost is honest, a guessed one
 * is a credibility hole. Estimates are always labeled "estimated" downstream.
 */

export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** Longest matching prefix wins (ids carry date suffixes, e.g. claude-haiku-4-5-20251001). */
const PRICE_BY_PREFIX: Record<string, ModelPricing> = {
  "claude-fable-5": { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
  "claude-mythos-5": { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
  "claude-opus-4": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-4": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-sonnet-5": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

export function pricingFor(modelId: string): ModelPricing | undefined {
  let best: { prefix: string; pricing: ModelPricing } | undefined;
  for (const [prefix, pricing] of Object.entries(PRICE_BY_PREFIX)) {
    if (modelId.startsWith(prefix) && (!best || prefix.length > best.prefix.length)) {
      best = { prefix, pricing };
    }
  }
  return best?.pricing;
}
