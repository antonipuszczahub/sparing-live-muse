const STOP = new Set('a an the and or but so to of in on at for with is are was were be been it its this that i you we they he she my your our not no yes do does did have has had just about from as if then than really very okay ok well like'.split(' '));

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);

/**
 * Words in `heard` that the bot itself did not just say. Used to tell the user's
 * real voice apart from the bot's own speech leaking back through the microphone.
 */
export function novelWords(heard: string, botText: string): string[] {
  const bot = new Set(words(botText));
  return words(heard).filter((w) => !bot.has(w) && !STOP.has(w));
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
