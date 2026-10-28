import { ledger } from './ledger.ts';
import { BudgetError } from './client.ts';
import { FLAT_PRICES, tokenCost } from './models.ts';

/**
 * Responses API client with streaming. Web search grounding is only available here,
 * not on Chat Completions (docs: /docs/search-grounding).
 */
export type ResponseStep =
  | { kind: 'search'; text: string }
  | { kind: 'open'; text: string }
  | { kind: 'note'; text: string };

export interface ResponseOptions {
  model: string;
  input: string;
  kind: string;
  session?: string;
  effort?: 'minimal' | 'low' | 'medium' | 'high' | 'max';
  maxOutputTokens?: number;
  webSearch?: { contextSize?: 'low' | 'medium' | 'high' };
  signal?: AbortSignal;
}

export interface ResponseResult {
  text: string;
  sources: { title: string; url: string }[];
  searches: number;
}

interface Item {
  type: string;
  phase?: string;
  action?: { type?: string; query?: string; url?: string };
  content?: { type: string; text?: string; annotations?: { type: string; url?: string; title?: string }[] }[];
}

export async function respond(o: ResponseOptions, onStep: (s: ResponseStep) => void = () => {}): Promise<ResponseResult> {
  const guard = ledger.canSpend(o.session);
  if (!guard.ok) throw new BudgetError(guard.reason);

  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error('MODEL_API_KEY is not set (see .env.example)');
  const base = process.env.META_BASE_URL || 'https://api.meta.ai/v1';

  const t0 = Date.now();
  const res = await fetch(`${base}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: o.signal,
    body: JSON.stringify({
      model: o.model,
      input: o.input,
      stream: true,
      reasoning: o.effort ? { effort: o.effort } : undefined,
      max_output_tokens: o.maxOutputTokens,
      tools: o.webSearch ? [{ type: 'web_search', search_context_size: o.webSearch.contextSize ?? 'low' }] : undefined,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`Meta API error ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let searches = 0;
  let usage: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } } | undefined;
  const messages: string[] = [];
  const sources = new Map<string, string>();

  const handle = (event: string, data: Record<string, unknown>) => {
    if (event === 'response.output_item.done') {
      const item = data.item as Item;
      if (item.type === 'web_search_call' && item.action) {
        searches += 1;
        if (item.action.type === 'open_page' && item.action.url) {
          sources.set(item.action.url, item.action.url);
          onStep({ kind: 'open', text: item.action.url });
        }
        else if (item.action.query) onStep({ kind: 'search', text: item.action.query });
      }
      if (item.type === 'message') {
        const text = (item.content ?? []).map((c) => c.text ?? '').join('');
        if (item.phase === 'commentary') {
          if (text) onStep({ kind: 'note', text });
        } else {
          messages.push(text);
          for (const c of item.content ?? [])
            for (const a of c.annotations ?? []) if (a.type === 'url_citation' && a.url) sources.set(a.url, a.title ?? a.url);
        }
      }
    }
    if (event === 'response.completed') usage = (data.response as { usage?: typeof usage }).usage;
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const event = /^event: (.+)$/m.exec(block)?.[1];
        const data = /^data: (.+)$/m.exec(block)?.[1];
        if (!event || !data) continue;
        try {
          handle(event, JSON.parse(data));
        } catch {
          /* ignore malformed keep-alive frames */
        }
      }
    }
  } finally {
    const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
    ledger.record({
      kind: o.kind,
      model: o.model,
      session: o.session,
      promptTokens: usage?.input_tokens,
      cachedTokens: cached,
      completionTokens: usage?.output_tokens,
      costUsd:
        tokenCost(o.model, { prompt: usage?.input_tokens ?? 0, cached, completion: usage?.output_tokens ?? 0 }) +
        (searches * FLAT_PRICES.webSearchPer1k) / 1000,
      totalMs: Date.now() - t0,
    });
  }

  return {
    text: messages.at(-1) ?? '',
    sources: [...sources].map(([url, title]) => ({ url, title })),
    searches,
  };
}
