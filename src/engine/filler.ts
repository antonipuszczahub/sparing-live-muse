import type { Lang } from '../../shared/types.ts';

/**
 * A person does not sit in silence for two seconds while they think: they say "Hm." or "No tak." The model needs a
 * second or more before its first word, so when it has not started by FILLER_AFTER_MS the character says a short
 * acknowledgement from this list and the real reply follows it. The reply does not arrive sooner; the silence the
 * user feels is shorter. Never in two exchanges in a row, so it does not become a tic.
 */
export const FILLERS: Record<Lang, readonly string[]> = {
  en: ['Hm.', 'Right.', 'Okay.', 'I see.', 'Mhm.', 'Well.'],
  pl: ['Hm.', 'No tak.', 'Aha.', 'No dobrze.', 'Mhm.', 'Rozumiem.'],
};

/** The model has not produced a word by now: say a filler. Its median first word is about a second. */
export const FILLER_AFTER_MS = 650;
/** Fewer words than this and the user said "yes" or "no": a reply to that is quick, and "Hm." would be odd. */
export const FILLER_MIN_WORDS = 4;
/** At least this many of the character's turns between two fillers. */
export const FILLER_GAP = 2;

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** The filler the character says in its n-th turn (they rotate, so the same one does not come twice in a row). */
export const pickFiller = (lang: Lang, n: number): string => FILLERS[lang][Math.abs(n) % FILLERS[lang].length]!;

/** Does this turn of the user call for a filler, given how many of the character's turns have passed since the last one? */
export function wantsFiller(userText: string, botTurnsSinceFiller: number): boolean {
  return wordCount(userText) >= FILLER_MIN_WORDS && botTurnsSinceFiller >= FILLER_GAP;
}

const bare = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, '').trim();

/**
 * The model, not knowing a filler was said, may begin its reply with the same acknowledgement ("Hm. Ile to kosztuje?"):
 * that opening is dropped, so the user does not hear "Hm. Hm." A sentence that is only the filler becomes empty.
 */
export function withoutFiller(sentence: string, filler: string): string {
  if (!filler) return sentence;
  const f = bare(filler);
  const m = /^(\p{L}+(?:\s+\p{L}+)?)\s*[.,!?…]+\s*/u.exec(sentence.trim());
  if (m && bare(m[1]!) === f) return sentence.trim().slice(m[0].length);
  return bare(sentence) === f ? '' : sentence;
}
