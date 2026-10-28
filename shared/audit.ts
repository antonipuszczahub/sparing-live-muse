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
}

/**
 * The verdict is one sentence for the top of the report. The model occasionally copies the outcome
 * word ("lost") into it; then the first sentence of the summary is used instead.
 */
export function ensureVerdict(result: AuditResult): AuditResult {
  if (result.verdict.trim().split(/\s+/).filter(Boolean).length >= 3) return result;
  const first = result.summary.trim().match(/^.+?[.!?…](?=\s|$)/s)?.[0] ?? result.summary.trim();
  return { ...result, verdict: first.length > 160 ? `${first.slice(0, 157).trimEnd()}…` : first };
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
    },
    required: ['score', 'outcome', 'verdict', 'summary', 'skills', 'moments', 'nextFocus', 'weaknessTags'],
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
    interruptions: turns.filter((t) => t.role === 'bot' && t.text.endsWith('—')).length,
    hungUp,
    durationSec: Math.round(durationMs / 1000),
  };
}
