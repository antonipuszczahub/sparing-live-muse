import type { Mood } from '../../shared/types.ts';

/** Colour of each mood, indexed by the mood itself (1 hostile … 5 won over); index 0 is unused. */
export const MOOD_COLOR = ['', '#c92f15', '#b86a00', '#7d705f', '#2f8a1f', '#0f8060'] as const;

export const moodColor = (mood: Mood) => MOOD_COLOR[mood];

/** Colour of a moment in the review: the badge on the chart and its card in the replay. */
export const KIND_COLOR = { strength: '#2f8a1f', mistake: '#c92f15', 'turning-point': '#b86a00' } as const;

export const OUTCOME_COLOR = { won: '#2f8a1f', partial: '#b86a00', lost: '#c92f15' } as const;
