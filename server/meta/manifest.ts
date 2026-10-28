import type { LedgerEntry } from './ledger.ts';

/**
 * Turns the ledger (data/manifest.jsonl) into docs/MANIFEST.md: which models ran, where, how many
 * tokens, what they cost and how fast they were. The ledger holds no prompts, transcripts or audio,
 * so the page can be published as it is.
 */
export function parseManifest(text: string): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as LedgerEntry);
    } catch {
      // A half-written last line must not break the report.
    }
  }
  return out;
}

const ROLE: Record<string, string> = {
  'character-turn': 'Live counterpart (streamed turns)',
  'twin-research': 'Digital twin research with web search',
  'twin-format': 'Twin: structuring the findings',
  eye: 'Eye: reads the shared screen',
  audit: 'Post-call audit',
  asr: 'Realtime transcription',
  portrait: 'Face: portrait',
  'portrait-edit': 'Face: expression edit',
  'sam-face': 'Camera framing: face detection',
  'probe-open': 'Open-weights probe',
  probe: 'API probe',
};

export function quantile(values: number[], q: number): number | undefined {
  if (!values.length) return undefined;
  const v = [...values].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(q * v.length))];
}

const ms = (n: number | undefined) => (n === undefined ? 'n/a' : `${Math.round(n)} ms`);
const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;
const int = (n: number) => n.toLocaleString('en-US');
const provider = (e: LedgerEntry) => e.provider ?? 'meta';
const present = (v: number | undefined): number[] => (v === undefined ? [] : [v]);

function table(head: string[], rows: string[][]): string {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function group<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const i of items) {
    const k = key(i);
    m.set(k, [...(m.get(k) ?? []), i]);
  }
  return m;
}

export function renderManifest(entries: LedgerEntry[], opts: { generatedAt?: Date } = {}): string {
  const when = (opts.generatedAt ?? new Date()).toISOString().slice(0, 10);
  if (!entries.length) return `# Manifest\n\nGenerated ${when}. The ledger is empty: no model calls have been recorded yet.\n`;

  const sum = (es: LedgerEntry[], f: (e: LedgerEntry) => number | undefined) => es.reduce((s, e) => s + (f(e) ?? 0), 0);
  const sessions = new Set(entries.map((e) => e.session).filter(Boolean)).size;
  const first = new Date(Math.min(...entries.map((e) => e.t))).toISOString().slice(0, 10);
  const last = new Date(Math.max(...entries.map((e) => e.t))).toISOString().slice(0, 10);

  const byModel = [...group(entries, (e) => `${e.model}|${provider(e)}`)].map(([k, es]) => {
    const [model, prov] = k.split('|') as [string, string];
    return [
      `\`${model}\``,
      prov === 'open' ? 'open weights' : 'Meta Model API',
      int(es.length),
      int(sum(es, (e) => e.promptTokens)),
      int(sum(es, (e) => e.completionTokens)),
      usd(sum(es, (e) => e.costUsd)),
      ms(quantile(es.flatMap((e) => present(e.firstTokenMs)), 0.5)),
      ms(quantile(es.flatMap((e) => present(e.totalMs)), 0.95)),
    ];
  });

  const byRole = [...group(entries, (e) => e.kind)]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([kind, es]) => [
      ROLE[kind] ?? kind,
      [...new Set(es.map((e) => e.model))].map((m) => `\`${m}\``).join(', '),
      int(es.length),
      usd(sum(es, (e) => e.costUsd)),
    ]);

  const open = entries.filter((e) => provider(e) === 'open');
  const turns = entries.filter((e) => e.kind === 'character-turn');
  const openTurns = turns.filter((e) => provider(e) === 'open');
  const openSection = open.length
    ? `${table(
        ['Open-weights model', 'Calls', 'Character turns on open weights', 'Input tokens', 'Output tokens', 'First token (median)'],
        [...group(open, (e) => e.model)].map(([model, es]) => [
          `\`${model}\``,
          int(es.length),
          `${int(es.filter((e) => e.kind === 'character-turn').length)} of ${int(turns.length)} (${Math.round((100 * openTurns.length) / Math.max(1, turns.length))}%)`,
          int(sum(es, (e) => e.promptTokens)),
          int(sum(es, (e) => e.completionTokens)),
          ms(quantile(es.flatMap((e) => present(e.firstTokenMs)), 0.5)),
        ]),
      )}\n\nThese calls were served by an open-weights host and billed by it, outside the Meta cost above.`
    : 'No open-weights calls have been recorded yet. Set a host in `.env` (see `.env.example`), tick **Run the character on open weights** on the start screen, make a call, then run `npm run manifest` again.';

  const metaCost = sum(entries.filter((e) => provider(e) === 'meta'), (e) => e.costUsd);

  return `# Manifest

Generated ${when} from \`data/manifest.jsonl\`, the server's budget ledger. Every model call is appended there with its model, tokens, cost and latency; no prompts, transcripts or audio are recorded.

**${int(entries.length)}** model calls across **${int(sessions)}** sessions, ${first === last ? first : `${first} to ${last}`}. Cost billed by Meta: **${usd(metaCost)}**.

## By model

${table(['Model', 'Served by', 'Calls', 'Input tokens', 'Output tokens', 'Cost', 'First token (median)', 'Total (p95)'], byModel)}

## By role

${table(['Role', 'Model', 'Calls', 'Cost'], byRole)}

## Open weights

${openSection}

## Reproduce

\`\`\`bash
npm install
cp .env.example .env     # add MODEL_API_KEY, and an open-weights host if you have one
npm run check:meta       # probes the Meta Model API
npm run check:open       # probes the open-weights host
npm run eval             # 24 scripted calls, writes docs/EVAL.md
npm run manifest         # rebuilds this page from data/manifest.jsonl
\`\`\`
`;
}
