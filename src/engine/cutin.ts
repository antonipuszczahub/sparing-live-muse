import type { Lang, Level } from '../../shared/types.ts';
import { novelWords } from '../lib/text.ts';

/**
 * The character cutting in on a long monologue. The recogniser only ends a turn when the user stops, so a speaker who
 * never stops would never be answered; people interrupt at a breath. How long (and how many words) a user may go on
 * before the character cuts in at the next breath depends on the difficulty. Friendly never interrupts.
 */
export interface CutInPolicy {
  afterMs: number;
  minWords: number;
}

export const CUT_IN: Record<Level, CutInPolicy | null> = {
  1: null,
  2: { afterMs: 30_000, minWords: 60 },
  3: { afterMs: 18_000, minWords: 38 },
  4: { afterMs: 12_000, minWords: 24 },
};

/** No new words from the recogniser for this long: the speaker is drawing breath, and that is when a person cuts in. */
export const CUT_IN_PAUSE_MS = 650;
/** After a cut-in the user's continued talking cannot cancel the character's line until it has been heard this long. */
export const CUT_IN_GRACE_MS = 1_200;

const tokens = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean);
export const countWords = (s: string) => tokens(s).length;

/** Watches one stretch of continuous speech and says when it has gone on long enough for the character to cut in. */
export class CutInGate {
  private startedAt = 0;
  private words = 0;

  constructor(private policy: CutInPolicy | null) {}

  /** The recogniser reported the running transcript of the user's current stretch of speech. */
  heard(text: string, now: number) {
    if (!this.startedAt) this.startedAt = now;
    this.words = countWords(text);
  }

  /** The stretch ended: a final transcript came in, or the character cut in. */
  reset() {
    this.startedAt = 0;
    this.words = 0;
  }

  /** Called at a breath: has the user talked long enough, and said enough, for the character to cut in? */
  due(now: number): boolean {
    const p = this.policy;
    return Boolean(p) && this.startedAt > 0 && now - this.startedAt >= p!.afterMs && this.words >= p!.minWords;
  }
}

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

/**
 * What a transcript says beyond the part the character already cut in on. The recogniser keeps one running text per
 * stretch of speech, so after a cut-in it still starts with the words that were used: those are dropped. A few words
 * corrected inside the used part do not matter (most of the first words have to be the same), and a transcript that has
 * almost nothing new in it ("already handled") gives an empty string. Text that is not a continuation is returned whole.
 */
export function afterCutIn(heard: string, used: string, lang: Lang = 'en'): string {
  const u = used.trim().split(/\s+/).filter(Boolean);
  const h = heard.trim().split(/\s+/).filter(Boolean);
  if (!u.length) return heard.trim();
  // The running text only grows, so something much shorter than what was used is a new, short utterance ("yes, fine").
  if (h.length < u.length * 0.6) return heard.trim();
  const usedSet = new Set(u.map(norm));
  const head = h.slice(0, u.length);
  const sameHead = head.length > 0 && head.filter((w) => usedSet.has(norm(w))).length >= Math.ceil(head.length * 0.8);
  if (sameHead) return h.slice(u.length).join(' ');
  if (novelWords(heard, used, lang).length < 3) return '';
  return heard.trim();
}
