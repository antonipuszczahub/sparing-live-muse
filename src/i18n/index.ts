import { useSyncExternalStore } from 'react';
import { gendered, isLang } from '../../shared/lang.ts';
import type { Lang, Mood } from '../../shared/types.ts';
import { en, type Dict } from './en.ts';
import { pl } from './pl.ts';

const DICTS: Record<Lang, Dict> = { en, pl };
const KEY = 'sl.lang';

type Args<K extends keyof Dict> = Dict[K] extends (...a: infer A) => string ? A : [];

/** First visit: the browser language decides; after that the visitor's choice is remembered. */
function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* storage can be blocked; the default below still works */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

let current: Lang = initial();
const listeners = new Set<() => void>();

function announce(lang: Lang) {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
announce(current);

export const getLang = (): Lang => current;

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* not remembered, still applied */
  }
  announce(lang);
  listeners.forEach((l) => l());
}

/** Re-renders the component when the language changes. Call it once at the top of every screen. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getLang,
    () => 'en' as Lang,
  );
}

export function translate<K extends keyof Dict>(lang: Lang, key: K, ...args: Args<K>): string {
  const value = DICTS[lang][key] as unknown;
  return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : (value as string);
}

/** Text in the current language. Outside React it reads the language at call time. */
export function t<K extends keyof Dict>(key: K, ...args: Args<K>): string {
  return translate(current, key, ...args);
}

const MOOD_KEYS = ['mood3', 'mood1', 'mood2', 'mood3', 'mood4', 'mood5'] as const;

/** "Hostile" … "Won over", in the language of the call; Polish forms follow the gender of the character. */
export function moodLabel(mood: Mood, lang: Lang = current, gender: 'm' | 'f' = 'm'): string {
  const text = translate(lang, MOOD_KEYS[mood]);
  return lang === 'pl' ? gendered(text, gender) : text;
}
