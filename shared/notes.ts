import type { Lang } from './types.ts';

/**
 * Notes from the simulator to the character, written in square brackets as if they were spoken
 * into its ear. The character prompt tells it how to treat them, so they are in the call's language.
 */
export type SimNote = 'silent' | 'screen-shared' | 'rambling';

const NOTES: Record<Lang, Record<SimNote, string>> = {
  en: {
    silent: '[the user has been silent for a while]',
    'screen-shared': '[the user just shared their screen with you]',
    rambling: '[the user has been talking for a long time without letting you speak: you cut in now, in one or two short sentences, reacting to the most striking thing they said, the way a person interrupts]',
  },
  pl: {
    silent: '[rozmówca milczy od dłuższej chwili]',
    'screen-shared': '[rozmówca właśnie udostępnił Ci swój ekran]',
    rambling: '[rozmówca mówi bez przerwy od dłuższego czasu: wchodzisz mu w słowo jednym lub dwoma krótkimi zdaniami, reagując na to, co w jego słowach najbardziej rzuca się w oczy, tak jak robi to człowiek]',
  },
};

export const simNote = (note: SimNote, lang: Lang = 'en'): string => NOTES[lang][note];

/** The first message of a call: what the character does when the phone connects. */
export const beginNote = (opening: string, lang: Lang = 'en'): string => `[${opening} ${lang === 'pl' ? 'Zacznij teraz.' : 'Begin now.'}]`;
