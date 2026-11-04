import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { afterCutIn, CUT_IN, CUT_IN_HOLD_MS, CUT_IN_PAUSE_MS, CutInGate, countWords } from '../src/engine/cutin.ts';
import { CallEngine, type CallSnapshot } from '../src/engine/CallEngine.ts';
import type { EarsLike } from '../src/lib/metaEars.ts';
import type { SpeechOut } from '../src/lib/tts.ts';
import { simNote } from '../shared/notes.ts';
import type { Level, SessionConfig } from '../shared/types.ts';
import { rollVariant } from '../shared/variation.ts';

const RANT = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `słowo${from + i}`).join(' ');

test('the harder the level, the sooner the character cuts in, and Friendly never does', () => {
  assert.equal(CUT_IN[1], null);
  const [a, b, c] = [CUT_IN[2]!, CUT_IN[3]!, CUT_IN[4]!];
  assert.ok(a.afterMs > b.afterMs && b.afterMs > c.afterMs, 'time before a cut-in shrinks with the level');
  assert.ok(a.minWords > b.minWords && b.minWords > c.minWords, 'so does the number of words');
  assert.ok(c.afterMs >= 10_000, 'nobody is cut in on in the first sentences');
});

test('a gate is due only after enough time AND enough words of continuous speech', () => {
  const g = new CutInGate(CUT_IN[3]);
  g.heard(RANT(10), 1_000);
  assert.equal(g.due(1_000 + 5_000), false, 'too soon');
  g.heard(RANT(60), 1_000 + 17_000);
  assert.equal(g.due(1_000 + 17_000), false, 'long enough but not yet 18 s');
  assert.equal(g.due(1_000 + 18_000), true);
  const few = new CutInGate(CUT_IN[3]);
  few.heard(RANT(5), 0);
  assert.equal(few.due(60_000), false, 'a long silence with five words is not a monologue');
  g.reset();
  assert.equal(g.due(100_000), false, 'a new stretch starts from zero');
  assert.equal(new CutInGate(null).due(1e9), false);
  assert.equal(countWords('Raz, dwa — trzy! cztery.'), 4);
});

test('after a cut-in, only what was said beyond the used text counts', () => {
  const used = 'to jest bardzo długa wypowiedź która nie ma końca i trwa dalej';
  assert.equal(afterCutIn(`${used} a tu jest coś nowego`, used), 'a tu jest coś nowego');
  assert.equal(afterCutIn(used, used), '', 'the same text again: already handled');
  assert.equal(afterCutIn(used.replace('długa', 'długą').replace('końca', 'konca'), used), '', 'a few corrected words inside the used part do not matter');
  assert.equal(afterCutIn(`${used.replace('bardzo', 'barzo')} nowe słowa tutaj`, used), 'nowe słowa tutaj');
  assert.equal(afterCutIn('zupełnie inna sprawa która nie ma związku z tamtą rozmową wcale', used), 'zupełnie inna sprawa która nie ma związku z tamtą rozmową wcale');
  assert.equal(afterCutIn('tak dobrze', used), 'tak dobrze', 'a short new answer is never swallowed, even with common words in it');
  assert.equal(afterCutIn('cokolwiek', ''), 'cokolwiek', 'nothing used: the text as it is');
});

// ---- the engine, with a recogniser and a voice that are made up -------------------------------------------------------

class FakeEars implements EarsLike {
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

class FakeVoice implements SpeechOut {
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

const flush = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
};

interface Rig {
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

beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 });
  (globalThis as { window?: unknown }).window = globalThis;
});
afterEach(() => {
  mock.timers.reset();
  globalThis.fetch = realFetch;
  (globalThis as { window?: unknown }).window = realWindow;
});

async function rig(level: Level): Promise<Rig> {
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

/** The user talks for `seconds` without a break, the recogniser reporting its running text every 250 ms. Returns the running text. */
function talk(r: Rig, seconds: number, wordsPerSecond = 4, startWord = 0): string {
  let text = '';
  for (let step = 1; step <= seconds * 4; step++) {
    text = RANT(Math.round((step * wordsPerSecond) / 4), startWord);
    r.ears.onInterim(text);
    mock.timers.tick(250);
  }
  return text;
}

test('at Tough, a long monologue is cut in on at the next breath: one turn (marked as cut), one short interruption', async () => {
  const r = await rig(3);
  assert.equal(r.requests.length, 1);
  r.answers.push('Moment, przerwę.');
  const text = talk(r, 20); // 20 s, 80 words
  assert.equal(r.requests.length, 1, 'still talking: nothing yet');
  mock.timers.tick(CUT_IN_PAUSE_MS + 50); // a breath
  await flush();
  assert.equal(r.requests.length, 2, 'the character asked for its interrupting line');
  const second = r.requests[1]!.history;
  assert.equal(second.at(-1)!.text, simNote('rambling', 'pl'), 'the simulator tells it that it is interrupting');
  const user = second.filter((t) => t.role === 'user');
  assert.ok(user[0]!.text.endsWith(' —') && user[0]!.text.startsWith(text.slice(0, 30)), 'the user turn is what was said so far, marked as cut off');
  assert.deepEqual(r.voice.said.at(-1), 'Moment, przerwę.');
  assert.equal(r.last().turns.filter((t) => t.role === 'user').length, 1);
  r.engine.dispose();
});

test('the end of that monologue is not counted twice, and what is said after the cut-in is a new turn', async () => {
  const r = await rig(3);
  r.answers.push('Moment, przerwę.', 'No i co dalej?');
  const text = talk(r, 20);
  mock.timers.tick(CUT_IN_PAUSE_MS + 50);
  await flush();
  r.voice.end();
  await flush();
  const requests = r.requests.length;
  // the recogniser ends the stretch with the whole text: nothing new in it
  r.ears.onFinal(text, 0);
  await flush();
  assert.equal(r.requests.length, requests, 'no second answer to the same words');
  assert.equal(r.last().turns.filter((t) => t.role === 'user').length, 1);

  // and a fresh sentence afterwards is an ordinary turn
  r.ears.onFinal('A teraz konkretnie: dwanaście tysięcy złotych za dwa tygodnie.', 0);
  await flush();
  assert.equal(r.requests.length, requests + 1);
  assert.equal(r.last().turns.filter((t) => t.role === 'user').at(-1)!.text, 'A teraz konkretnie: dwanaście tysięcy złotych za dwa tygodnie.');
  r.engine.dispose();
});

test('words said after the cut-in, in the same stretch of speech, are what the next turn is made of', async () => {
  const r = await rig(3);
  r.answers.push('Moment, przerwę.', 'Słucham.');
  const text = talk(r, 20);
  mock.timers.tick(CUT_IN_PAUSE_MS + 50);
  await flush();
  r.voice.end();
  await flush();
  r.ears.onFinal(`${text} oraz dalej mówię jeszcze kilka zdań o tym`, 0);
  await flush();
  assert.equal(r.last().turns.filter((t) => t.role === 'user').at(-1)!.text, 'oraz dalej mówię jeszcze kilka zdań o tym');
  r.engine.dispose();
});

test('the cut-in line is heard to the end, and what the user says meanwhile is their next turn after it', async () => {
  const r = await rig(3);
  let release!: (s: string) => void;
  r.answers.push(new Promise<string>((res) => (release = res)));
  const text = talk(r, 20);
  mock.timers.tick(CUT_IN_PAUSE_MS + 50);
  await flush();
  assert.equal(r.requests.length, 2, 'the character is thinking about its interruption');
  // the user keeps going while it thinks and while it speaks: new words, more than two
  const more = 'i jeszcze więcej nowych słów ciągle mówię dalej';
  r.ears.onInterim(`${text} ${more}`);
  await flush();
  release('Moment, przerwę. Co dokładnie Pan chce mi sprzedać?');
  await flush();
  assert.equal(r.requests.length, 2, 'the thinking turn was not thrown away and asked again');
  assert.ok(r.voice.said.join(' ').includes('Moment, przerwę.'), 'the interruption was spoken');
  r.ears.onInterim(`${text} ${more} oraz kolejne zupełnie nowe wyrazy`);
  await flush();
  assert.equal(r.voice.cancelled, 0, 'talking over the interruption does not cut it short: it is heard to the end');
  // the recogniser ends the stretch with everything said: the part after the cut-in waits
  r.ears.onFinal(`${text} ${more} oraz kolejne zupełnie nowe wyrazy`, 0);
  await flush();
  assert.equal(r.requests.length, 2, 'not answered yet: the character is still talking');
  assert.equal(r.last().turns.filter((t) => t.role === 'user').length, 1, 'and not a second user turn in a row');
  r.answers.push('Słucham.');
  r.voice.end();
  await flush();
  assert.deepEqual(
    r.last().turns.map((t) => t.role),
    ['bot', 'user', 'bot', 'user'],
    'the turns alternate: the user (cut), the interruption, then what the user said meanwhile',
  );
  assert.equal(r.last().turns.at(-1)!.text, `${more} oraz kolejne zupełnie nowe wyrazy`);
  assert.equal(r.requests.length, 3, 'and the character answers it');
  assert.equal(r.requests[2]!.history.at(-1)!.text, `${more} oraz kolejne zupełnie nowe wyrazy`);
  r.engine.dispose();
});

test('if the voice never reports the end of the cut-in line, talking over it works again after a while', async () => {
  const r = await rig(3);
  const text = talk(r, 20);
  r.answers.push('Moment, przerwę.');
  mock.timers.tick(CUT_IN_PAUSE_MS + 50);
  await flush();
  assert.equal(r.requests.length, 2);
  r.ears.onInterim(`${text} i jeszcze więcej nowych słów ciągle mówię dalej`);
  await flush();
  assert.equal(r.voice.cancelled, 0);
  mock.timers.tick(CUT_IN_HOLD_MS + 500);
  r.ears.onInterim(`${text} i jeszcze więcej nowych słów ciągle mówię dalej oraz kolejne zupełnie nowe wyrazy`);
  await flush();
  assert.equal(r.voice.cancelled > 0, true, 'the hold has a limit, so a silent voice cannot lock the call');
  r.engine.dispose();
});

test('Friendly never cuts in, a short turn at Tough does not, and the microphone mute stops the gate', async () => {
  const f = await rig(1);
  talk(f, 60);
  mock.timers.tick(CUT_IN_PAUSE_MS + 50);
  await flush();
  assert.equal(f.requests.length, 1, 'Friendly lets you talk for ever');
  f.engine.dispose();

  const t = await rig(3);
  talk(t, 10, 2); // 20 words in 10 s
  mock.timers.tick(CUT_IN_PAUSE_MS + 50);
  await flush();
  assert.equal(t.requests.length, 1, 'neither long enough nor wordy enough');
  t.engine.dispose();

  const m = await rig(3);
  talk(m, 20);
  m.engine.setMuted(true);
  mock.timers.tick(CUT_IN_PAUSE_MS + 50);
  await flush();
  assert.equal(m.requests.length, 1, 'muted: the character hears nothing, so it cannot cut in');
  m.engine.dispose();
});
