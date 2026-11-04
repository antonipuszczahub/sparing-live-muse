import type { Lang, Turn } from '../../shared/types.ts';

/*
 * A language model that is told "react, and ask one specific question" does exactly that every turn, and a call
 * then sounds like an interview form. Variety cannot be left to the model, so the server looks at the last lines the
 * character spoke and, when it has been asking turn after turn, closes the question for this one. It also asks for a
 * different first word than the last line. The rule is plain code on the history: no extra model call, no delay.
 */

const TEXT = {
  en: {
    noQuestion: 'This turn do NOT ask a question: react, push back, say what you think, or concede one point.',
    differently: (w: string) => `Your last line began with “${w}”: begin differently.`,
  },
  pl: {
    noQuestion: 'W tej turze NIE zadawaj pytania: zareaguj, zaprotestuj, powiedz, co o tym myślisz, albo ustąp w jednej sprawie.',
    differently: (w: string) => `Twoja poprzednia kwestia zaczynała się od „${w}”: zacznij inaczej.`,
  },
} as const;

/** A line asks when it ends in a question mark (a cut-off line in the transcript carries a trailing dash). */
export const endsAsking = (text: string) => /\?\s*[—–-]?\s*$/.test(text.trim());

const firstWord = (text: string) => (text.trim().split(/\s+/)[0] ?? '').replace(/[^\p{L}\p{N}']/gu, '').toLowerCase();

/** A number in [0, 1) that is the same for the same call and the same turn, and different between them. */
export function roll(seed: number, turn: number): number {
  let x = (Math.imul(seed | 0, 374761393) + Math.imul(turn, 668265263)) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 2 ** 32;
}

/** How likely a turn is closed to questions after the character asked in its last line (after two in a row it always is). */
export const CLOSE_AFTER_ONE = 0.6;

/** The extra line for the character's next turn, or undefined when nothing needs saying (the opening line, or `TURN_HINT=off`). */
export function turnHint(history: Turn[], lang: Lang, seed: number): string | undefined {
  if (process.env.TURN_HINT === 'off') return undefined;
  const people = history.filter((t) => t.role === 'user' && !/^\[.*\]$/s.test(t.text.trim()));
  const bots = history.filter((t) => t.role === 'bot');
  if (!people.length || !bots.length) return undefined;

  let run = 0;
  for (let i = bots.length - 1; i >= 0 && endsAsking(bots[i]!.text); i--) run++;

  const T = TEXT[lang];
  const lines: string[] = [];
  if (run >= 2 || (run === 1 && roll(seed, people.length) < CLOSE_AFTER_ONE)) lines.push(T.noQuestion);
  const w = firstWord(bots[bots.length - 1]!.text);
  if (w.length > 1) lines.push(T.differently(w));
  return lines.length ? lines.join(' ') : undefined;
}
