/**
 * Models sometimes add stage directions like "*sigh*" or "(pauses)". A voice would read them
 * aloud, so they are removed from anything that is spoken or shown as speech.
 */
export function cleanSpeech(text: string): string {
  return text
    .replace(/\*[^*]*\*/g, ' ')
    .replace(/\*[^*]*$/, '') // a direction that is still being streamed
    .replace(/\((?:[^)]{1,40})\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trimStart();
}
