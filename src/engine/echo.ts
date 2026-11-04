import type { Lang } from '../../shared/types.ts';
import { looksLikeEcho, novelWords } from '../lib/text.ts';

/** How many new words a transcript needs before it counts as the user talking over the character. */
export const MIN_BARGE_WORDS = 2;
/** The recogniser reports a line a moment after it was spoken: its echo can still arrive this long after the character stops. */
export const ECHO_TAIL_MS = 4_000;

type Phase = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'ended';

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
