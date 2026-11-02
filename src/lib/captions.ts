import type { Turn } from '../../shared/types.ts';

export interface Caption {
  /** Stable while a line goes from live to finished, so it does not animate in twice. */
  key: string;
  role: 'bot' | 'user';
  text: string;
  /** Still being said or heard. */
  live: boolean;
  /** The character's latest line, shown large. */
  now: boolean;
  /** Said by you after the character's latest line. */
  recent: boolean;
}

/**
 * The lines on the call screen instead of chat bubbles: the last few turns fading upwards,
 * the character's current line large, and what you are saying right now under it.
 */
export function buildCaptions(turns: Turn[], liveBot: string, liveUser: string, keep = 6): Caption[] {
  const lines: Caption[] = turns.map((t, i) => ({ key: `t${i}`, role: t.role, text: t.text, live: false, now: false, recent: false }));
  let next = turns.length;
  if (liveBot) lines.push({ key: `t${next++}`, role: 'bot', text: liveBot, live: true, now: false, recent: false });
  if (liveUser) lines.push({ key: `t${next}`, role: 'user', text: liveUser, live: true, now: false, recent: false });
  const last = lines.map((l) => l.role).lastIndexOf('bot');
  if (last >= 0) lines[last]!.now = true;
  lines.forEach((l, i) => {
    l.recent = l.role === 'user' && i > last;
  });
  return lines.slice(-keep);
}

/** Long monologues get a smaller type size so they stay on the screen. */
export function captionSize(text: string): 'normal' | 'long' | 'huge' {
  const words = text.trim().split(/\s+/).length;
  return words > 52 ? 'huge' : words > 28 ? 'long' : 'normal';
}
