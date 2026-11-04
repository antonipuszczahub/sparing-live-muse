import type { TraceRow } from '../../shared/trace.ts';
import type { LedgerEntry } from './ledger.ts';

export type { TraceRow };

/** The order of a call: ears, character, research, face, review. */
const ORDER = ['asr', 'character-turn', 'eye', 'twin-research', 'twin-format', 'portrait', 'portrait-edit', 'sam-face', 'audit'];

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return Math.round(s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2);
};

/** Groups a session's ledger entries into rows. Prompts, transcripts and audio are never in the ledger, so none can be shown. */
export function traceRows(entries: LedgerEntry[], openHost = 'open-weights host'): TraceRow[] {
  const groups = new Map<string, { entries: LedgerEntry[] }>();
  for (const e of entries) {
    const key = `${e.kind}|${e.model}|${e.provider ?? ''}`;
    (groups.get(key) ?? groups.set(key, { entries: [] }).get(key)!).entries.push(e);
  }
  const rows = [...groups.values()].map(({ entries: es }): TraceRow => {
    const first = es[0]!;
    const open = first.provider === 'open';
    const external = first.provider === 'elevenlabs';
    return {
      kind: first.kind,
      model: first.model,
      served: open ? `Open weights · ${openHost}` : external ? 'Third-party service' : 'Meta Model API',
      open,
      calls: es.length,
      medianMs: first.kind === 'asr' ? null : median(es.map((e) => e.totalMs).filter((n): n is number => typeof n === 'number')),
      costUsd: es.reduce((sum, e) => sum + e.costUsd, 0),
    };
  });
  const rank = (k: string) => (ORDER.includes(k) ? ORDER.indexOf(k) : ORDER.length);
  return rows.sort((a, b) => rank(a.kind) - rank(b.kind) || a.model.localeCompare(b.model));
}
