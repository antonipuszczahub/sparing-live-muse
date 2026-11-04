const KEY = 'sl.ptt';

/** Push to talk is off unless the user turned it on in the voice and microphone sheet. */
export function getPtt(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setPtt(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* not remembered, still applied for this visit */
  }
}

/**
 * How long the microphone stays open after the key or the button is let go. Muse Voice Transcribe delivers the final
 * text about 0.4 s after speech ends, and a muted engine drops it, so muting at once would lose the last words.
 */
export const PTT_RELEASE_MS = 900;

interface Clock {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const realClock: Clock = {
  set: (fn, ms) => window.setTimeout(fn, ms),
  clear: (h) => window.clearTimeout(h as number),
};

/**
 * The microphone for push to talk, on top of the call engine's mute (the engine itself is not touched): muted from the
 * start, open while the key or button is held and for a moment after, then muted again. Pressing again inside that
 * moment keeps it open.
 */
export class TalkGate {
  private timer: unknown;

  constructor(
    private readonly setMuted: (muted: boolean) => void,
    private readonly releaseMs = PTT_RELEASE_MS,
    private readonly clock: Clock = realClock,
  ) {}

  /** The call starts: nobody is talking yet. */
  start() {
    this.setMuted(true);
  }

  press() {
    this.clock.clear(this.timer);
    this.timer = undefined;
    this.setMuted(false);
  }

  release() {
    this.clock.clear(this.timer);
    this.timer = this.clock.set(() => {
      this.timer = undefined;
      this.setMuted(true);
    }, this.releaseMs);
  }

  dispose() {
    this.clock.clear(this.timer);
    this.timer = undefined;
  }
}
