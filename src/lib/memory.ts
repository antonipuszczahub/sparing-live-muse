/**
 * What the user keeps getting wrong, remembered between calls in this browser.
 * The auditor tags weak spots after each call; the next character aims at the most frequent ones.
 */
const KEY = 'sl.weak.v1';

interface Entry {
  tag: string;
  count: number;
  last: number;
}

function load(): Entry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Entry[];
  } catch {
    return [];
  }
}

function save(entries: Entry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* private mode: the app works without memory */
  }
}

export function recordWeakSpots(tags: string[]) {
  const entries = load();
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().slice(0, 60);
    if (!tag) continue;
    const e = entries.find((x) => x.tag === tag);
    if (e) {
      e.count += 1;
      e.last = Date.now();
    } else entries.push({ tag, count: 1, last: Date.now() });
  }
  save(entries.sort((a, b) => b.last - a.last).slice(0, 30));
}

/** Most frequent first, recent ones win ties. */
export function topWeakSpots(n = 3): string[] {
  return load()
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, n)
    .map((e) => e.tag);
}

export function clearWeakSpots() {
  save([]);
}
