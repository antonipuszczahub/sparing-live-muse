import type { Lang } from '../../shared/types.ts';
import { looksLikeEcho, novelWords } from '../lib/text.ts';

/** How many new words a transcript needs before it counts as the user talking over the character. */
export const MIN_BARGE_WORDS = 2;
/** The recogniser reports a line a moment after it was spoken: its echo can still arrive this long after the character stops. */
export const ECHO_TAIL_MS = 4_000;

/** A barge-in this soon after the character started a line is more likely its own voice than the user. */
export const EARLY_BARGE_MS = 1_200;
/** How many such signs in one call before the user is told about headphones (one deliberate quick interruption must not trigger it). */
export const ECHO_SIGNS_BEFORE_HINT = 3;

type Phase = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'ended';

/**
 * Notices when the character seems to be hearing itself (speakers instead of headphones): transcripts that were
 * filtered out as its own voice, and barge-ins that come almost the moment it starts talking. The browser's echo
 * cancellation has no reference for speech synthesis, so this happens on laptop speakers; a person who interrupts
 * quickly once or twice is not echo, so the hint waits for several signs.
 */
export class EchoWatch {
  private signs = 0;

  /** The recogniser's transcript was judged to be the character's own voice. */
  filtered() {
    this.signs++;
  }

  /** The user (or the echo) barged in `msSinceLineStarted` after the character began speaking. */
  bargeIn(msSinceLineStarted: number) {
    if (msSinceLineStarted < EARLY_BARGE_MS) this.signs++;
  }

  get suspected(): boolean {
    return this.signs >= ECHO_SIGNS_BEFORE_HINT;
  }
}

/**
 * Is this transcript the character's own voice coming back through the speakers?
 * While it speaks, anything with fewer than two new words is echo. Just after it stopped, a transcript that is
 * almost entirely its last line is echo too; short answers such as "yes" are never treated as echo.
 */
export function isBotEcho(phase: Phase, msSinceBotQuiet: number, heard: string, botText: string, lang: Lang): boolean {
  if (phase === 'speaking') return novelWords(heard, botText, lang).length < MIN_BARGE_WORDS;
  if (phase === 'listening' && msSinceBotQuiet < ECHO_TAIL_MS) return looksLikeEcho(heard, botText, lang);
  return false;
}
