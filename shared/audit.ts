import type { Lang, Turn } from './types.ts';

export interface Moment {
  /** Index into the transcript (Turn[]). */
  turn: number;
  kind: 'strength' | 'mistake' | 'turning-point';
  what: string;
  /** Why it mattered, citing what the character really thought where possible. */
  why: string;
  /** For mistakes: what the user should have said instead. */
  betterLine?: string;
}

/** A slip in the user's own words (grammar, a wrong or clumsy word), with the corrected phrase. */
export interface Wording {
  /** Index into the transcript: always one of the user's lines. */
  turn: number;
  /** An exact quote from that line. */
  said: string;
  better: string;
  /** What was wrong, a few words. */
  note: string;
}

export interface AuditResult {
  score: number;
  outcome: 'won' | 'partial' | 'lost';
  verdict: string;
  summary: string;
  skills: { clarity: number; listening: number; objections: number; specificity: number; composure: number };
  moments: Moment[];
  /** What to work on next time, short and concrete. */
  nextFocus: string[];
  /** Short tags that are remembered across sessions and aimed at by the next character. */
  weaknessTags: string[];
  /** Language slips found in what the user said (at most three; empty when there is nothing clear to flag). */
  wording?: Wording[];
}

/** The longest verdict that still reads as a headline (the report sets it in large type). */
export const MAX_VERDICT_CHARS = 180;

const firstSentence = (s: string) => s.trim().match(/^.+?[.!?…](?=\s|$)/s)?.[0] ?? s.trim();
const clip = (s: string) => (s.length > MAX_VERDICT_CHARS ? `${s.slice(0, MAX_VERDICT_CHARS - 3).replace(/\s+\S*$/, '').trimEnd()}…` : s);

/**
 * The verdict is one sentence for the top of the report. The model occasionally copies the outcome
 * word ("lost") into it; then the first sentence of the summary is used instead. It also sometimes writes a whole
 * paragraph there, which would fill the screen in headline type: the first sentence stays as the verdict and the rest
 * moves to the front of the summary, so nothing the coach said is lost.
 */
export function ensureVerdict(result: AuditResult): AuditResult {
  const verdict = result.verdict.trim();
  if (verdict.split(/\s+/).filter(Boolean).length < 3) return { ...result, verdict: clip(firstSentence(result.summary)) };
  if (verdict.length <= MAX_VERDICT_CHARS) return result;
  const head = firstSentence(verdict);
  if (head.length <= MAX_VERDICT_CHARS) {
    const rest = verdict.slice(head.length).trim();
    return { ...result, verdict: head, summary: [rest, result.summary.trim()].filter(Boolean).join(' ') };
  }
  return { ...result, verdict: clip(head), summary: [verdict, result.summary.trim()].filter(Boolean).join(' ') };
}

export const AUDIT_SCHEMA = {
  name: 'call_audit',
  schema: {
    type: 'object',
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 100 },
      outcome: { type: 'string', enum: ['won', 'partial', 'lost'] },
      verdict: { type: 'string' },
      summary: { type: 'string' },
      skills: {
        type: 'object',
        properties: {
          clarity: { type: 'integer', minimum: 0, maximum: 10 },
          listening: { type: 'integer', minimum: 0, maximum: 10 },
          objections: { type: 'integer', minimum: 0, maximum: 10 },
          specificity: { type: 'integer', minimum: 0, maximum: 10 },
          composure: { type: 'integer', minimum: 0, maximum: 10 },
        },
        required: ['clarity', 'listening', 'objections', 'specificity', 'composure'],
        additionalProperties: false,
      },
      moments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            turn: { type: 'integer', minimum: 0 },
            kind: { type: 'string', enum: ['strength', 'mistake', 'turning-point'] },
            what: { type: 'string' },
            why: { type: 'string' },
            betterLine: { type: 'string' },
          },
          required: ['turn', 'kind', 'what', 'why', 'betterLine'],
          additionalProperties: false,
        },
      },
      nextFocus: { type: 'array', items: { type: 'string' } },
      weaknessTags: { type: 'array', items: { type: 'string' } },
      wording: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            turn: { type: 'integer', minimum: 0 },
            said: { type: 'string' },
            better: { type: 'string' },
            note: { type: 'string' },
          },
          required: ['turn', 'said', 'better', 'note'],
          additionalProperties: false,
        },
      },
    },
    required: ['score', 'outcome', 'verdict', 'summary', 'skills', 'moments', 'nextFocus', 'weaknessTags', 'wording'],
    additionalProperties: false,
  },
} as const;

export interface DeliveryMetrics {
  userTurns: number;
  userWords: number;
  /** Average words per user turn. */
  avgWordsPerTurn: number;
  longestTurnWords: number;
  fillerCount: number;
  fillersPerHundredWords: number;
  /** Words said twice in a row, a phrase said twice, and words cut off or restarted ("w-w-wiesz", "wen- went"). */
  repeats: number;
  /** Times the user cut the character off mid-sentence. */
  interruptions: number;
  /** The character ended the call. */
  hungUp: boolean;
  durationSec: number;
}

const FILLER_RE: Record<Lang, RegExp> = {
  en: /\b(um+|uh+|er+|ah+|hmm+|you know|i mean|sort of|kind of|basically|actually|literally|like,)\b/gi,
  // \b does not understand Polish letters, so the edges are checked with Unicode lookarounds.
  pl: /(?<![\p{L}\p{N}])(y{2,}|e{2,}|m{2,}|hm+|no więc|w sumie|tak jakby|jakby|generalnie|w zasadzie|właściwie|znaczy|wiesz|po prostu|powiedzmy|tak naprawdę)(?![\p{L}\p{N}])/giu,
};

const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;

// Words that are said twice on purpose ("very very", "no no", "bye bye") are not a hesitation.
const EMPHASIS: Record<Lang, Set<string>> = {
  en: new Set(['very', 'no', 'so', 'bye', 'really', 'yes', 'well', 'ha', 'hey', 'now', 'more', 'long', 'far', 'many', 'ok', 'okay']),
  pl: new Set(['nie', 'tak', 'no', 'bardzo', 'dobrze', 'ok', 'hej', 'ha', 'dalej', 'więc']),
};
// "w-w-wiesz", "I-I think" (a start repeated before the word) and "wen- went" (a word that was cut off).
const RESTART_RE = /(?<![\p{L}\p{N}-])(\p{L}{1,4})(?:-\1)+(?:-\p{L}+)?(?![\p{L}\p{N}-])|(?<![\p{L}\p{N}-])\p{L}{2,}-(?=\s|$)/giu;

/**
 * Hesitation that shows in the text: a word said twice in a row ("I, I think"), a two-word phrase said twice ("we think we
 * think"), and words that were restarted or cut off. It is counted on the transcript the speech recognition produced, which
 * can smooth such things away, so it is a floor and a hint, never a diagnosis.
 */
export function countRepeats(text: string, lang: Lang = 'en'): number {
  let n = text.match(RESTART_RE)?.length ?? 0;
  const tokens = text.replace(RESTART_RE, ' ').toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? [];
  for (let i = 0; i < tokens.length; ) {
    if (i + 3 < tokens.length && tokens[i] === tokens[i + 2] && tokens[i + 1] === tokens[i + 3] && tokens[i] !== tokens[i + 1]) {
      n++;
      i += 2;
      continue;
    }
    if (i > 0 && tokens[i] === tokens[i - 1] && !EMPHASIS[lang].has(tokens[i]!)) n++;
    i++;
  }
  return n;
}

const plain = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * The model is asked to quote the user. Only slips whose quote really is in that user line are kept (a quote that was not
 * said is dropped, so the report never puts words in the user's mouth), at most three, in the order of the call.
 */
export function cleanWording(items: Wording[] | undefined, turns: Turn[]): Wording[] {
  const out: Wording[] = [];
  for (const w of items ?? []) {
    const line = turns[w.turn];
    const said = (w.said ?? '').trim();
    const better = (w.better ?? '').trim();
    if (!line || line.role !== 'user' || plain(said).length < 3 || !better) continue;
    if (!plain(line.text).includes(plain(said)) || plain(said) === plain(better)) continue;
    out.push({ turn: w.turn, said, better, note: (w.note ?? '').trim() });
  }
  return out.sort((a, b) => a.turn - b.turn).slice(0, 3);
}

/** Delivery numbers measured from the transcript, so the audit cites facts instead of guesses. */
export function measureDelivery(turns: Turn[], durationMs: number, hungUp: boolean, lang: Lang = 'en'): DeliveryMetrics {
  const user = turns.filter((t) => t.role === 'user');
  const words = user.map((t) => wc(t.text));
  const total = words.reduce((a, b) => a + b, 0);
  const fillers = user.reduce((n, t) => n + (t.text.match(FILLER_RE[lang])?.length ?? 0), 0);
  return {
    userTurns: user.length,
    userWords: total,
    avgWordsPerTurn: user.length ? Math.round(total / user.length) : 0,
    longestTurnWords: Math.max(0, ...words),
    fillerCount: fillers,
    fillersPerHundredWords: total ? Math.round((fillers / total) * 1000) / 10 : 0,
    repeats: user.reduce((n, t) => n + countRepeats(t.text, lang), 0),
    interruptions: turns.filter((t) => t.role === 'bot' && t.text.endsWith('—')).length,
    hungUp,
    durationSec: Math.round(durationMs / 1000),
  };
}
