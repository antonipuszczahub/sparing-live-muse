export interface VoicePick {
  voice: SpeechSynthesisVoice | null;
  natural: boolean;
}

const MALE = /guy|davis|andrew|brian|christopher|eric|roger|steffan|ryan|william|mark|david/i;
const FEMALE = /aria|jenny|michelle|emma|ava|sonia|libby|zira|susan|jane|nancy/i;

export function voices(): SpeechSynthesisVoice[] {
  return speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
}

export function pickVoice(gender: 'm' | 'f'): VoicePick {
  const vs = voices();
  const natural = vs.filter((v) => /natural|neural/i.test(v.name));
  const pool = natural.length ? natural : vs;
  const re = gender === 'm' ? MALE : FEMALE;
  const voice = pool.find((v) => re.test(v.name)) ?? pool.find((v) => /en-US|en-GB/i.test(v.lang)) ?? pool[0] ?? null;
  return { voice, natural: natural.length > 0 && !!voice && /natural|neural/i.test(voice.name) };
}

/** Speaks sentences one after another and reports what has actually been spoken. */
export class Speaker {
  private queue: string[] = [];
  private playing = false;
  private spoken = '';
  private closed = true;
  private watchdog: number | undefined;
  private gen = 0;
  onIdle: () => void = () => {};
  onStart: () => void = () => {};

  constructor(private voice: SpeechSynthesisVoice | null, private rate = 1.04) {}

  get spokenText() {
    return this.spoken.trim();
  }

  get busy() {
    return this.playing || this.queue.length > 0;
  }

  say(sentence: string) {
    this.closed = false;
    this.queue.push(sentence);
    if (!this.playing) this.next();
  }

  /** No more sentences are coming for this turn. */
  finish() {
    this.closed = true;
    if (!this.busy) this.onIdle();
  }

  /** Start a new turn: forget what was spoken in the previous one. */
  reset() {
    this.spoken = '';
  }

  cancel() {
    this.gen++;
    this.queue = [];
    this.closed = true;
    this.playing = false;
    window.clearTimeout(this.watchdog);
    speechSynthesis.cancel();
  }

  private next() {
    const text = this.queue.shift();
    if (text === undefined) {
      this.playing = false;
      if (this.closed) this.onIdle();
      return;
    }
    this.playing = true;
    const gen = this.gen;
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.lang = this.voice?.lang ?? 'en-US';
    u.rate = this.rate;
    let started = false;
    let finished = false;
    const done = () => {
      if (finished || gen !== this.gen) return;
      finished = true;
      window.clearTimeout(this.watchdog);
      this.spoken += ' ' + text;
      this.next();
    };
    const begin = () => {
      if (started) return;
      started = true;
      window.clearTimeout(this.watchdog);
      if (!this.spoken) this.onStart();
    };
    u.onstart = begin;
    u.onend = done;
    u.onerror = () => {
      // Voice failed: fall back to reading time so the call keeps moving as text.
      begin();
      this.watchdog = window.setTimeout(done, Math.min(4000, text.length * 45));
    };
    speechSynthesis.speak(u);
    // No audio engine or no voices (some browsers, remote sessions): do not hang the call.
    this.watchdog = window.setTimeout(() => {
      if (started) return;
      speechSynthesis.cancel();
      begin();
      this.watchdog = window.setTimeout(done, Math.min(4000, text.length * 45));
    }, 1500);
  }
}
