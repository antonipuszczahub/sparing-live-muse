import { LANG_META } from '../../shared/lang.ts';
import type { Lang } from '../../shared/types.ts';

export interface VoicePick {
  voice: SpeechSynthesisVoice | null;
  /** A neural ("Natural") voice, which sounds far less robotic. */
  natural: boolean;
  /** The voice's name fits the character's gender. If not, the speaker lowers or raises the pitch a little. */
  matched: boolean;
}

// Names of the voices that ship with Edge, Windows and Chrome, by gender. Browsers do not report gender.
const NAMES: Record<Lang, { m: RegExp; f: RegExp }> = {
  en: {
    m: /guy|davis|andrew|brian|christopher|eric|roger|steffan|ryan|william|mark|david/i,
    f: /aria|jenny|michelle|emma|ava|sonia|libby|zira|susan|jane|nancy/i,
  },
  pl: {
    m: /marek|adam|jakub|krzysztof|filip|pawel|paweł|bartek/i,
    f: /zofia|paulina|agnieszka|ewa|maja|anna/i,
  },
};

export function voices(lang: Lang = 'en'): SpeechSynthesisVoice[] {
  return speechSynthesis.getVoices().filter((v) => new RegExp(`^${lang}`, 'i').test(v.lang));
}

export function pickVoice(gender: 'm' | 'f', lang: Lang = 'en'): VoicePick {
  const vs = voices(lang);
  const natural = vs.filter((v) => /natural|neural/i.test(v.name));
  const pool = natural.length ? natural : vs;
  const re = NAMES[lang][gender];
  const named = pool.find((v) => re.test(v.name));
  const exact = pool.find((v) => v.lang.replace('_', '-').toLowerCase() === LANG_META[lang].speech.toLowerCase());
  const voice = named ?? exact ?? pool[0] ?? null;
  return { voice, natural: !!voice && /natural|neural/i.test(voice.name), matched: !!named };
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

  constructor(
    private voice: SpeechSynthesisVoice | null,
    private lang: Lang = 'en',
    private pitch = 1,
    private rate = 1.04,
  ) {}

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
    u.lang = this.voice?.lang ?? LANG_META[this.lang].speech;
    u.rate = this.rate;
    u.pitch = this.pitch;
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
