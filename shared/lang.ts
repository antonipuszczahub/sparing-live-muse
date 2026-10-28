import type { Lang } from './types.ts';

export const LANGS: readonly Lang[] = ['en', 'pl'];

export const isLang = (x: unknown): x is Lang => x === 'en' || x === 'pl';

/** The language of a session; sessions made before languages existed are English. */
export const langOf = (c: { lang?: Lang } | undefined): Lang => c?.lang ?? 'en';

export interface LangMeta {
  /** Name in its own language, for the switch. */
  name: string;
  /** What Muse Voice Transcribe calls it in `languageBias`. */
  asr: string;
  /** BCP 47 tag for speech synthesis and the browser recognizer. */
  speech: string;
}

export const LANG_META: Record<Lang, LangMeta> = {
  en: { name: 'English', asr: 'English', speech: 'en-US' },
  pl: { name: 'Polski', asr: 'Polish', speech: 'pl-PL' },
};

/**
 * Polish words change with the speaker's gender. Authored Polish text marks them as `{man|woman}`:
 * "zmęczon{y|a}" reads "zmęczony" for a man and "zmęczona" for a woman, "przeczyta{ł|ła}" reads
 * "przeczytał" or "przeczytała". Text without markers is returned unchanged.
 */
export function gendered(text: string, gender: 'm' | 'f'): string {
  return text.replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, m: string, f: string) => (gender === 'm' ? m : f));
}

/** Polish plural: 1 turę, 2 tury, 5 tur, 22 tury. */
export function pluralPl(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n);
  if (a === 1) return one;
  const last = a % 10;
  const tens = a % 100;
  return last >= 2 && last <= 4 && !(tens >= 12 && tens <= 14) ? few : many;
}
