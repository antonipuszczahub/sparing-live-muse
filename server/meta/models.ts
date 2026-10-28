import { openHost } from './open.ts';

// Model IDs and prices from https://dev.meta.ai/docs/models and /docs/pricing-rate-limits (checked 2026-10-27).
export const MODELS = {
  /** Live counterpart, screen understanding. */
  spark: process.env.SPARK_MODEL || 'muse-spark-1.3',
  /** Open weights on whichever host is configured (see open.ts). Billed by that host, not from the Meta budget. */
  get open(): string {
    return openHost()?.model ?? 'meta-models/muse-spark-open-1026';
  },
  /** Cheap twin for development only: Meta may train on prompts. Never used for juror sessions. */
  sparkDev: 'muse-spark-1.3-contributor',
  /** Research (digital twin) and post-call audit. */
  wonder: 'muse-wonder-1.0',
  image: 'muse-image-1.0',
  transcribe: 'muse-voice-transcribe-1.0',
  sam: 'sam-3.1',
} as const;

export interface TokenPrice {
  input: number;
  cachedInput: number;
  output: number;
}

/** USD per 1M tokens. */
export const TOKEN_PRICES: Record<string, TokenPrice> = {
  'muse-spark-1.3': { input: 1.25, cachedInput: 0.15, output: 4.25 },
  'muse-spark-1.2': { input: 1.25, cachedInput: 0.15, output: 4.25 },
  'muse-spark-1.1': { input: 1.25, cachedInput: 0.15, output: 4.25 },
  'muse-spark-1.3-contributor': { input: 0.1, cachedInput: 0.002, output: 0.2 },
  'muse-spark-1.2-contributor': { input: 0.1, cachedInput: 0.002, output: 0.2 },
  'muse-wonder-1.0': { input: 4, cachedInput: 0.2, output: 20 },
};

export const FLAT_PRICES = {
  imagePerImage: 0.01,
  transcribePerHour: 0.18,
  samPer1kImages: 2.5,
  samPer1kVideoFrames: 0.2,
  webSearchPer1k: 2.5,
} as const;

export function tokenCost(model: string, usage: { prompt: number; cached: number; completion: number }): number {
  const p = TOKEN_PRICES[model];
  if (!p) return 0;
  const fresh = Math.max(0, usage.prompt - usage.cached);
  return (fresh * p.input + usage.cached * p.cachedInput + usage.completion * p.output) / 1_000_000;
}
