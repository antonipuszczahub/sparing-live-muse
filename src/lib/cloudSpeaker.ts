import type { Lang } from '../../shared/types.ts';
import { estimateSpoken, PCM_RATE, pcm16ToFloat32 } from './pcm.ts';
import type { SpeechOut } from './tts.ts';

/** The slice of the Web Audio API this class uses, so it can run against a fake clock in tests. */
export interface AudioOut {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  close(): Promise<void>;
  createBuffer(channels: number, length: number, rate: number): { duration: number; copyToChannel(data: Float32Array, channel: number): void };
  createBufferSource(): { buffer: unknown; connect(to: unknown): void; start(at: number): void; stop(): void; onended: ((ev: Event) => unknown) | null };
}

export interface CloudDeps {
  audio: AudioOut;
  fetchFn: typeof fetch;
  /** Speaks one sentence with the browser's voice (the fallback). */
  browser: (text: string) => Promise<void>;
  cancelBrowser: () => void;
  /** Resolves after ms; injected so tests can move a fake clock instead of waiting. */
  wait?: (ms: number) => Promise<void>;
}

interface Item {
  text: string;
  response: Promise<Response | null>;
  /** When its first piece of audio starts, on the audio clock. */
  startAt?: number;
  /** Seconds of audio received so far. */
  seconds: number;
  done: boolean;
  viaBrowser: boolean;
}

const MIN_PIECE = 6000; // samples (0.25 s) collected before a piece of audio is scheduled
const SECONDS_PER_CHAR = 0.065; // estimate of a sentence's length while it is still arriving

/**
 * Speaks for the character with audio from /api/tts. Sentences are requested the moment they stream in and
 * played back to back on the audio clock, so there is no gap between them and the next one is usually ready
 * before the current one ends. If the cloud voice fails, the browser voice takes over for the rest of the call.
 */
export class CloudSpeaker implements SpeechOut {
  onIdle: () => void = () => {};
  onStart: () => void = () => {};
  /** Called once with a code ("limit", "quota", "auth", "unavailable", "audio") when the browser voice takes over. */
  onFallback: (code: string) => void = () => {};

  private items: Item[] = [];
  private cursor = 0;
  private playhead = 0;
  private running = false;
  private closed = true;
  private dead = false;
  private started = false;
  private gen = 0;
  private abort = new AbortController();
  private sources = new Set<{ stop(): void }>();
  private wake: (() => void) | null = null;
  private readonly wait: (ms: number) => Promise<void>;

  constructor(
    private session: string,
    private lang: Lang,
    private voiceId: string,
    private deps: CloudDeps,
  ) {
    this.wait = deps.wait ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    void deps.audio.resume().catch(() => undefined);
  }

  get busy() {
    return this.running || this.deps.audio.currentTime < this.playhead;
  }

  /** The sentences heard so far, and for the one playing now the share of its words its audio has covered. */
  get spokenText() {
    const now = this.deps.audio.currentTime;
    const parts: string[] = [];
    for (const it of this.items) {
      if (it.viaBrowser) {
        if (!it.done) break;
        parts.push(it.text);
        continue;
      }
      if (it.startAt === undefined) break;
      const total = it.done ? it.seconds : Math.max(it.seconds, it.text.length * SECONDS_PER_CHAR);
      const played = now - it.startAt;
      if (it.done && played >= total - 0.05) {
        parts.push(it.text);
        continue;
      }
      if (played > 0) parts.push(estimateSpoken(it.text, played / total));
      break;
    }
    return parts.join(' ').trim();
  }

  say(sentence: string) {
    this.closed = false;
    const previous = this.items.at(-1)?.text;
    this.items.push({ text: sentence, response: this.request(sentence, previous), seconds: 0, done: false, viaBrowser: false });
    if (this.running) this.wake?.();
    else void this.run(this.gen);
  }

  /** No more sentences are coming for this turn. */
  finish() {
    this.closed = true;
    if (this.running) this.wake?.();
    else if (!this.busy) this.onIdle();
  }

  /** Start a new turn: forget what was spoken in the previous one. */
  reset() {
    this.items = [];
    this.cursor = 0;
    this.started = false;
  }

  cancel() {
    this.gen++;
    this.abort.abort();
    this.abort = new AbortController();
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.items = [];
    this.cursor = 0;
    this.playhead = 0;
    this.closed = true;
    this.running = false;
    this.started = false;
    this.wake?.();
    this.deps.cancelBrowser();
  }

  dispose() {
    this.cancel();
    void this.deps.audio.close().catch(() => undefined);
  }

  private lost(code: string) {
    if (this.dead) return;
    this.dead = true;
    this.onFallback(code);
  }

  private request(text: string, previous?: string): Promise<Response | null> {
    if (this.dead) return Promise.resolve(null);
    const signal = this.abort.signal;
    return this.deps
      .fetchFn('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: this.session, text, lang: this.lang, voice: this.voiceId, previous }),
        signal,
      })
      .then(async (r) => {
        if (r.ok && r.body) return r;
        const code = await r.json().then((j: { code?: string }) => j.code ?? 'unavailable').catch(() => 'unavailable');
        this.lost(code);
        return null;
      })
      .catch(() => {
        if (!signal.aborted) this.lost('unavailable');
        return null;
      });
  }

  private async run(gen: number) {
    this.running = true;
    for (;;) {
      if (gen !== this.gen) return;
      const item = this.items[this.cursor];
      if (!item) {
        if (this.closed) break;
        await new Promise<void>((r) => (this.wake = r));
        continue;
      }
      this.cursor++;
      await this.play(item, gen);
    }
    // Everything is queued. The turn is over when it has been heard, not when it has been downloaded.
    await this.untilPlayed(gen);
    if (gen !== this.gen) return;
    this.running = false;
    this.onIdle();
  }

  private async untilPlayed(gen: number) {
    const a = this.deps.audio;
    while (gen === this.gen && a.currentTime < this.playhead - 0.01) await this.wait((this.playhead - a.currentTime) * 1000 + 40);
  }

  private async viaBrowser(item: Item, gen: number) {
    item.viaBrowser = true;
    await this.untilPlayed(gen); // whatever was already scheduled finishes first
    if (gen !== this.gen) return;
    await this.deps.browser(item.text);
    if (gen === this.gen) item.done = true;
  }

  /** Turns the PCM that has arrived into audio on the clock, right after what is already scheduled. */
  private schedule(item: Item, gen: number, parts: Float32Array[], length: number) {
    const a = this.deps.audio;
    const all = new Float32Array(length);
    let at = 0;
    for (const p of parts) {
      all.set(p, at);
      at += p.length;
    }
    const buffer = a.createBuffer(1, all.length, PCM_RATE);
    buffer.copyToChannel(all, 0);
    const source = a.createBufferSource();
    source.buffer = buffer;
    source.connect(a.destination);
    const start = Math.max(this.playhead, a.currentTime + 0.03);
    source.start(start);
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
    item.startAt ??= start;
    item.seconds += buffer.duration;
    this.playhead = start + buffer.duration;
    if (!this.started) {
      this.started = true;
      void this.wait(Math.max(0, (start - a.currentTime) * 1000)).then(() => gen === this.gen && this.onStart());
    }
  }

  private async play(item: Item, gen: number) {
    const res = await item.response;
    if (gen !== this.gen) return;
    if (!res) return this.viaBrowser(item, gen);

    const a = this.deps.audio;
    if (a.state !== 'running') {
      await Promise.race([a.resume().catch(() => undefined), this.wait(1500)]);
      if (gen !== this.gen) return;
      if (a.state !== 'running') {
        // A browser that will not start audio (autoplay policy): use its own voice instead of hanging the call.
        void res.body?.cancel().catch(() => undefined);
        this.lost('audio');
        return this.viaBrowser(item, gen);
      }
    }

    const reader = res.body!.getReader();
    let carry: Uint8Array = new Uint8Array(0);
    let parts: Float32Array[] = [];
    let length = 0;
    const flush = () => {
      if (!length) return;
      this.schedule(item, gen, parts, length);
      parts = [];
      length = 0;
    };
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (gen !== this.gen) return void reader.cancel().catch(() => undefined);
        if (done) break;
        const { samples, rest } = pcm16ToFloat32(value, carry);
        carry = rest;
        if (samples.length) {
          parts.push(samples);
          length += samples.length;
          if (length >= MIN_PIECE) flush();
        }
      }
      flush();
    } catch {
      if (gen !== this.gen) return;
      flush(); // what arrived before the stream broke is still played
      this.lost('unavailable');
    }
    item.done = true;
  }
}
