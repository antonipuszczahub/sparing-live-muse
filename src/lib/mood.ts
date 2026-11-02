import type { Mood } from '../../shared/types.ts';

/** Colour of each mood, indexed by the mood itself (1 hostile … 5 won over); index 0 is unused. */
export const MOOD_COLOR = ['', '#f0603f', '#e0a73e', '#aeb99e', '#92d450', '#dff07a'] as const;

export const moodColor = (mood: Mood) => MOOD_COLOR[mood];

/** Colour of a moment in the review: the badge on the chart and its card in the replay. */
export const KIND_COLOR = { strength: '#92d450', mistake: '#f0603f', 'turning-point': '#e0a73e' } as const;

export const OUTCOME_COLOR = { won: '#92d450', partial: '#e0a73e', lost: '#f0603f' } as const;
