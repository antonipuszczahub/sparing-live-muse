import { useEffect } from 'react';
import type { Mood } from '../../shared/types.ts';
import { MOOD_COLOR } from './mood.ts';

/**
 * Tints the whole app with a mood: --mc colours the light, rings and labels.
 * The colour fades because --mc is a registered property (see index.css).
 */
export function useMoodTheme(mood: Mood | null, color?: string) {
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--mood', String(mood ?? 3));
    root.setProperty('--mc', color ?? (mood ? MOOD_COLOR[mood] : '#7d705f'));
    return () => {
      root.removeProperty('--mood');
      root.removeProperty('--mc');
    };
  }, [mood, color]);
}
