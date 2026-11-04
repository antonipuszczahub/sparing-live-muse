import { mock } from 'node:test';
import { CallEngine, type CallSnapshot } from '../src/engine/CallEngine.ts';
import type { EarsLike } from '../src/lib/metaEars.ts';
import type { SpeechOut } from '../src/lib/tts.ts';
import type { Level, SessionConfig } from '../shared/types.ts';
import { rollVariant } from '../shared/variation.ts';

/**
 * A call engine with a recogniser, a voice and a server that are made up, for tests that need to watch the loop:
 * the clock is the mocked one (`mock.timers`), a reply can be a promise to keep the character "thinking",
 * and `voice.said` is what it would have spoken.
 */
export class FakeEars implements EarsLike {
  onInterim: (t: string) => void = () => {};
  onFinal: (t: string, at: number) => void = () => {};
  onError: (m: string, fatal: boolean) => void = () => {};
  muted = false;
  start() {}
  stop() {}
  setMuted(m: boolean) {
    this.muted = m;
  }
}

export class FakeVoice implements SpeechOut {
  onIdle: () => void = () => {};
  onStart: () => void = () => {};
  said: string[] = [];
  cancelled = 0;
  busy = false;
  get spokenText() {
    return this.said.join(' ');
  }
  say(s: string) {
    if (!this.busy) {
      this.busy = true;
      this.onStart();
    }
    this.said.push(s);
  }
  finish() {}
  reset() {
    this.said = [];
  }
  cancel() {
    this.cancelled++;
    this.busy = false;
  }
  /** The browser finished speaking. */
  end() {
    this.busy = false;
    this.onIdle();
  }
}

const sse = (reply: string, mood = 3) =>
  `event: say\ndata: ${JSON.stringify({ delta: reply })}\n\nevent: final\ndata: ${JSON.stringify({ reply, thought: 'x', mood, hangup: false })}\n\n`;

export const flush = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
};

export interface Rig {
  engine: CallEngine;
  ears: FakeEars;
  voice: FakeVoice;
  requests: { history: { role: string; text: string }[] }[];
  last: () => CallSnapshot;
  /** What the next /api/turn answers; a promise lets the test keep the character "thinking". */
  answers: (string | Promise<string>)[];
}

const realFetch = globalThis.fetch;
const realWindow = (globalThis as { window?: unknown }).window;

/** Call in `beforeEach`. */
export function installClock() {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 });
  (globalThis as { window?: unknown }).window = globalThis;
}

/** Call in `afterEach`. */
export function restoreClock() {
  mock.timers.reset();
  globalThis.fetch = realFetch;
  (globalThis as { window?: unknown }).window = realWindow;
}

/** A started call whose opening line ("Halo?") has been said, so the engine is listening. */
export async function rig(level: Level): Promise<Rig> {
  const v = rollVariant('sales', 5, 'pl');
  const config: SessionConfig = { scenario: 'sales', level, topic: 'Strona', persona: v.persona, variant: 5, lang: 'pl', user: { gender: 'm', formal: false } };
  const ears = new FakeEars();
  const voice = new FakeVoice();
  const requests: Rig['requests'] = [];
  const answers: Rig['answers'] = ['Halo?'];
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    requests.push(JSON.parse(init?.body ?? '{}') as Rig['requests'][number]);
    const reply = await (answers.shift() ?? 'Dobrze.');
    return new Response(sse(reply), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }) as typeof fetch;
  let snap!: CallSnapshot;
  const engine = new CallEngine(config, 'session-test', (s) => (snap = s), () => undefined, { ears, speaker: voice });
  engine.start();
  await flush();
  voice.end(); // "Halo?" has been said: the call is listening
  await flush();
  return { engine, ears, voice, requests, last: () => snap, answers };
}
