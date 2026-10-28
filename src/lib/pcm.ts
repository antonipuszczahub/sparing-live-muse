/**
 * Raw audio from the voice service is 16-bit little-endian PCM at 24 kHz, arriving in network chunks that
 * can end in the middle of a sample. These helpers are pure so they can be tested without a browser.
 */
export const PCM_RATE = 24000;

/** Converts a chunk to floats. `carry` is the odd byte left over from the previous chunk; the new leftover is returned. */
export function pcm16ToFloat32(chunk: Uint8Array, carry: Uint8Array = new Uint8Array(0)): { samples: Float32Array; rest: Uint8Array } {
  const bytes = new Uint8Array(carry.length + chunk.length);
  bytes.set(carry, 0);
  bytes.set(chunk, carry.length);
  const n = Math.floor(bytes.length / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { samples, rest: bytes.slice(n * 2) };
}

/**
 * What had been said when the user cut in: the words of `text` in proportion to how much of its audio had played.
 * Under a tenth of a sentence counts as nothing, because the first word is hardly out by then.
 */
export function estimateSpoken(text: string, played: number): string {
  if (played < 0.1) return '';
  const words = text.split(/\s+/).filter(Boolean);
  return words.slice(0, Math.min(words.length, Math.floor(words.length * played))).join(' ');
}
