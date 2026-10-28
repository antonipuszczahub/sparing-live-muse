import { LANG_META } from '../../shared/lang.ts';
import type { Lang } from '../../shared/types.ts';

export interface VoicePick<V = SpeechSynthesisVoice> {
  voice: V | null;
  /** A neural ("Natural") voice, which sounds far less robotic than the basic system voices. */
  natural: boolean;
  /** The voice's name fits the character's gender. If not, the speaker lowers or raises the pitch a little. */
  matched: boolean;
}

type VoiceLike = { name: string; lang: string };

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

export const isNatural = (v: VoiceLike) => /natural|neural/i.test(v.name);

/** Browsers do not report a voice's gender, so it is read from the name; null when the name is not a known one. */
export function genderOf(v: VoiceLike, lang: Lang): 'm' | 'f' | null {
  if (NAMES[lang].m.test(v.name)) return 'm';
  if (NAMES[lang].f.test(v.name)) return 'f';
  return null;
}

/** The voices that can play a character of this gender: the ones named for it, plus the ones whose gender is unknown. */
export function voicesFor<V extends VoiceLike>(vs: V[], lang: Lang, gender: 'm' | 'f'): V[] {
  return vs.filter((v) => {
    const g = genderOf(v, lang);
    return g === null || g === gender;
  });
}

export function voices(lang: Lang = 'en'): SpeechSynthesisVoice[] {
  return speechSynthesis.getVoices().filter((v) => new RegExp(`^${lang}`, 'i').test(v.lang));
}

/** Natural voices first, then the rest by name, so the list in the picker starts with the best ones. */
export function sortVoices<V extends VoiceLike>(vs: V[]): V[] {
  return [...vs].sort((a, b) => Number(isNatural(b)) - Number(isNatural(a)) || a.name.localeCompare(b.name));
}

/**
 * The voice for a character: the one the user chose if it is still there, otherwise a Natural voice of the
 * right gender, otherwise any Natural voice, otherwise a basic one of the right gender, otherwise the first.
 */
export function rankVoices<V extends VoiceLike>(vs: V[], lang: Lang, gender: 'm' | 'f', saved?: string | null, seed = 0): VoicePick<V> {
  const chosen = saved ? vs.find((v) => v.name === saved) : undefined;
  if (chosen) return { voice: chosen, natural: isNatural(chosen), matched: true };
  const natural = vs.filter(isNatural);
  const pool = natural.length ? natural : vs;
  const re = NAMES[lang][gender];
  // Several voices fit the gender (Edge has many English Natural voices): the character's seed picks one, so the
  // same person always sounds the same and different calls sound like different people.
  const fitting = pool.filter((v) => re.test(v.name));
  const named = fitting.length ? fitting[Math.abs(Math.trunc(seed)) % fitting.length] : undefined;
  const exact = pool.find((v) => v.lang.replace('_', '-').toLowerCase() === LANG_META[lang].speech.toLowerCase());
  const voice = named ?? exact ?? pool[0] ?? null;
  return { voice, natural: !!voice && isNatural(voice), matched: !!named };
}

const STORE = 'sl.voice.v1';
const slot = (lang: Lang, gender: 'm' | 'f') => `${lang}:${gender}`;

/** The voice the user picked for a language and gender, remembered in this browser. */
export function savedVoice(lang: Lang, gender: 'm' | 'f'): string | null {
  try {
    return (JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, string>)[slot(lang, gender)] ?? null;
  } catch {
    return null;
  }
}

export function saveVoice(lang: Lang, gender: 'm' | 'f', name: string | null) {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, string>;
    if (name) all[slot(lang, gender)] = name;
    else delete all[slot(lang, gender)];
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    /* the choice just is not remembered */
  }
}

export function pickVoice(gender: 'm' | 'f', lang: Lang = 'en', seed = 0): VoicePick {
  return rankVoices(voices(lang), lang, gender, savedVoice(lang, gender), seed);
}

/** Says a short sample with a voice, for the picker. */
export function previewVoice(voice: SpeechSynthesisVoice | null, text: string, lang: Lang, pitch = 1) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? LANG_META[lang].speech;
  u.pitch = pitch;
  speechSynthesis.speak(u);
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

/** Pitch correction for a voice that does not fit the character's gender (Windows ships one Polish voice per gender at best). */
export const pitchFor = (matched: boolean, gender: 'm' | 'f'): number => (matched ? 1 : gender === 'm' ? 0.8 : 1.1);

/** What the call engine needs from whatever speaks for the character: the browser's voice or a cloud voice. */
export interface SpeechOut {
  onIdle: () => void;
  onStart: () => void;
  readonly spokenText: string;
  readonly busy: boolean;
  say(sentence: string): void;
  finish(): void;
  reset(): void;
  cancel(): void;
  dispose?(): void;
}

/** Says one sentence with the browser's voice and resolves when it has been spoken (or the browser gave up). */
export function speakBrowser(text: string, voice: SpeechSynthesisVoice | null, lang: Lang, pitch = 1, rate = 1.04): Promise<void> {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? LANG_META[lang].speech;
    u.pitch = pitch;
    u.rate = rate;
    // Some browsers never report the end of an utterance; do not hang the call on that.
    const watchdog = window.setTimeout(done, Math.max(3000, text.length * 110));
    function done() {
      window.clearTimeout(watchdog);
      resolve();
    }
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
  });
}

export const cancelBrowserSpeech = () => speechSynthesis.cancel();
