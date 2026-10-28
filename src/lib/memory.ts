import type { Lang } from '../../shared/types.ts';

/**
 * What the user keeps getting wrong, remembered between calls in this browser.
 * The auditor tags weak spots after each call; the next character aims at the most frequent ones.
 * Tags are written in the language of the call, so each language keeps its own list.
 */
const key = (lang: Lang) => (lang === 'en' ? 'sl.weak.v1' : `sl.weak.v1.${lang}`);

interface Entry {
  tag: string;
  count: number;
  last: number;
}

function load(lang: Lang): Entry[] {
  try {
    return JSON.parse(localStorage.getItem(key(lang)) ?? '[]') as Entry[];
  } catch {
    return [];
  }
}

function save(lang: Lang, entries: Entry[]) {
  try {
    localStorage.setItem(key(lang), JSON.stringify(entries));
  } catch {
    /* private mode: the app works without memory */
  }
}

export function recordWeakSpots(tags: string[], lang: Lang = 'en') {
  const entries = load(lang);
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().slice(0, 60);
    if (!tag) continue;
    const e = entries.find((x) => x.tag === tag);
    if (e) {
      e.count += 1;
      e.last = Date.now();
    } else entries.push({ tag, count: 1, last: Date.now() });
  }
  save(lang, entries.sort((a, b) => b.last - a.last).slice(0, 30));
}

/** Most frequent first, recent ones win ties. */
export function topWeakSpots(n = 3, lang: Lang = 'en'): string[] {
  return load(lang)
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, n)
    .map((e) => e.tag);
}

export function clearWeakSpots(lang: Lang = 'en') {
  save(lang, []);
}
