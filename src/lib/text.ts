import type { Lang } from '../../shared/types.ts';

const STOP: Record<Lang, Set<string>> = {
  en: new Set('a an the and or but so to of in on at for with is are was were be been it its this that i you we they he she my your our not no yes do does did have has had just about from as if then than really very okay ok well like'.split(' ')),
  pl: new Set(
    'i a w z na do to jest są był była było będzie się nie tak ale czy że jak co ten ta te tu tam ja ty my wy on ona ono oni one mnie mi cię ci go ją jej ich nas was wam już jeszcze też tylko bardzo no więc dobrze ok oczywiście proszę pan pani państwo mam masz ma mamy macie mają mój twój nasz wasz po za od przez dla bez o u'.split(' '),
  ),
};

// Letters, not [a-z]: "ą", "ł" or "ż" must stay inside words or every Polish word would be cut in pieces.
const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean);

/**
 * Words in `heard` that the bot itself did not just say. Used to tell the user's
 * real voice apart from the bot's own speech leaking back through the microphone.
 */
export function novelWords(heard: string, botText: string, lang: Lang = 'en'): string[] {
  const bot = new Set(words(botText));
  return words(heard).filter((w) => !bot.has(w) && !STOP[lang].has(w));
}

/**
 * True when `heard` is almost entirely the bot's own last line (at least four words, at most a fifth of them new):
 * its voice coming back through the speakers after it has stopped. Short answers such as "yes" are never echo.
 */
export function looksLikeEcho(heard: string, botText: string, lang: Lang = 'en'): boolean {
  const count = words(heard).length;
  return count >= 4 && novelWords(heard, botText, lang).length <= Math.floor(count * 0.2);
}

/**
 * The first clause of a reply, before its first sentence is finished: at least three words and fourteen characters,
 * closed by a comma, semicolon, colon or dash and followed by a space ("3,5" is never cut). The character can start
 * speaking it while the model is still writing the rest of the sentence.
 */
export function takeFirstClause(buf: string): { clause: string; rest: string } | null {
  const m = /^(.{14,}?[,;:—–])\s+/s.exec(buf);
  if (!m) return null;
  const clause = m[1]!.trim();
  if (clause.split(/\s+/).length < 3) return null;
  return { clause, rest: buf.slice(m[0].length) };
}

/** Split text into complete sentences and a remainder. */
export function takeSentences(buf: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let rest = buf;
  // A sentence only counts as finished once whitespace follows it, so "3.5" or "Mr." are not split.
  for (;;) {
    const m = /^(.+?[.!?…]+["')\]]*)\s+/s.exec(rest);
    if (!m) break;
    sentences.push(m[1]!.trim());
    rest = rest.slice(m[0].length);
  }
  return { sentences, rest };
}
