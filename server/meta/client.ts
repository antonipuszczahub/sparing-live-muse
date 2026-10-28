import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ledger } from './ledger.ts';
import { tokenCost } from './models.ts';

export type ChatMessage = ChatCompletionMessageParam;

export class BudgetError extends Error {
  constructor(public reason: 'daily' | 'session') {
    super(reason === 'daily' ? 'Daily budget reached' : 'Session budget reached');
  }
}

/** meta = Meta Model API. open = Muse Spark Open weights served by Baseten (same OpenAI-compatible protocol). */
export type Provider = 'meta' | 'open';

const clients: Partial<Record<Provider, OpenAI>> = {};

export function openWeightsConfigured(): boolean {
  return Boolean(process.env.BASETEN_API_KEY);
}

export function meta(provider: Provider = 'meta'): OpenAI {
  let client = clients[provider];
  if (!client) {
    if (provider === 'open') {
      const apiKey = process.env.BASETEN_API_KEY;
      if (!apiKey) throw new Error('BASETEN_API_KEY is not set (see .env.example)');
      client = new OpenAI({ baseURL: process.env.OPEN_BASE_URL || 'https://inference.baseten.co/v1', apiKey });
    } else {
      const apiKey = process.env.MODEL_API_KEY;
      if (!apiKey) throw new Error('MODEL_API_KEY is not set (see .env.example)');
      client = new OpenAI({ baseURL: process.env.META_BASE_URL || 'https://api.meta.ai/v1', apiKey });
    }
    clients[provider] = client;
  }
  return client;
}

export interface CallOptions {
  model: string;
  provider?: Provider;
  messages: ChatMessage[];
  kind: string;
  session?: string;
  maxTokens?: number;
  temperature?: number;
  /** "minimal" for live turns, higher for audits. Passed through as reasoning_effort. */
  effort?: 'minimal' | 'low' | 'medium' | 'high' | 'max';
  /** JSON schema the answer must follow. */
  schema?: { name: string; schema: Record<string, unknown> };
  signal?: AbortSignal;
}

function params(o: CallOptions) {
  return {
    model: o.model,
    messages: o.messages,
    max_tokens: o.maxTokens,
    temperature: o.temperature,
    // reasoning_effort is a Meta API parameter; the open-weights host is not guaranteed to accept it.
    ...(o.effort && o.provider !== 'open' ? { reasoning_effort: o.effort } : {}),
    ...(o.schema
      ? { response_format: { type: 'json_schema' as const, json_schema: { name: o.schema.name, schema: o.schema.schema, strict: true } } }
      : {}),
  };
}

function guard(session?: string) {
  const g = ledger.canSpend(session);
  if (!g.ok) throw new BudgetError(g.reason);
}

/** One-shot completion. Returns the full text. */
export async function complete(o: CallOptions): Promise<string> {
  guard(o.session);
  const t0 = Date.now();
  const res = await meta(o.provider).chat.completions.create(params(o) as never, { signal: o.signal });
  const r = res as OpenAI.Chat.Completions.ChatCompletion;
  const u = r.usage;
  const cached = (u as { prompt_tokens_details?: { cached_tokens?: number } } | undefined)?.prompt_tokens_details?.cached_tokens ?? 0;
  ledger.record({
    kind: o.kind,
    model: o.model,
    provider: o.provider,
    session: o.session,
    promptTokens: u?.prompt_tokens,
    cachedTokens: cached,
    completionTokens: u?.completion_tokens,
    costUsd: tokenCost(o.model, { prompt: u?.prompt_tokens ?? 0, cached, completion: u?.completion_tokens ?? 0 }),
    totalMs: Date.now() - t0,
  });
  return r.choices[0]?.message?.content ?? '';
}

/** Streaming completion. Calls onDelta for each text chunk and returns the full text. */
export async function stream(o: CallOptions, onDelta: (text: string) => void): Promise<string> {
  guard(o.session);
  const t0 = Date.now();
  let firstTokenMs: number | undefined;
  let text = '';
  let usage: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } | undefined;

  const s = await meta(o.provider).chat.completions.create(
    { ...params(o), stream: true, stream_options: { include_usage: true } } as never,
    { signal: o.signal },
  );
  try {
    for await (const chunk of s as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
      if (chunk.usage) usage = chunk.usage as typeof usage;
      const d = chunk.choices[0]?.delta?.content;
      if (d) {
        firstTokenMs ??= Date.now() - t0;
        text += d;
        onDelta(d);
      }
    }
  } finally {
    const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
    ledger.record({
      kind: o.kind,
      model: o.model,
      provider: o.provider,
      session: o.session,
      promptTokens: usage?.prompt_tokens,
      cachedTokens: cached,
      completionTokens: usage?.completion_tokens,
      costUsd: tokenCost(o.model, { prompt: usage?.prompt_tokens ?? 0, cached, completion: usage?.completion_tokens ?? 0 }),
      firstTokenMs,
      totalMs: Date.now() - t0,
    });
  }
  return text;
}
