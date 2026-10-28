import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CloudSpeaker, type AudioOut } from '../src/lib/cloudSpeaker.ts';

class FakeAudio implements AudioOut {
  currentTime = 0;
  state = 'running';
  destination = {};
  played: { start: number; duration: number; stopped: boolean }[] = [];
  resume = async () => {};
  close = async () => {};
  createBuffer(_c: number, length: number, rate: number) {
    return { duration: length / rate, copyToChannel() {} };
  }
  createBufferSource() {
    const rec = { start: 0, duration: 0, stopped: false };
    this.played.push(rec);
    const src = {
      buffer: null as { duration: number } | null,
      connect() {},
      start: (at: number) => {
        rec.start = at;
        rec.duration = src.buffer!.duration;
      },
      stop: () => {
        rec.stopped = true;
      },
      onended: null as ((ev: Event) => unknown) | null,
    };
    return src;
  }
}

const seconds = (s: number) => new Uint8Array(Math.round(s * 24000) * 2).fill(7);

/** A response whose body arrives in pieces of `piece` bytes, which may cut a sample in half. */
const audioResponse = (s: number, piece = 4000) => {
  const bytes = seconds(s);
  return new Response(
    new ReadableStream({
      start(c) {
        for (let i = 0; i < bytes.length; i += piece) c.enqueue(bytes.slice(i, i + piece));
        c.close();
      },
    }),
    { status: 200 },
  );
};

const tick = (ms = 1) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, label: string) {
  for (let i = 0; i < 500 && !cond(); i++) await tick();
  assert.ok(cond(), `timed out waiting for ${label}`);
}

function rig(handler: (n: number, text: string) => Response | Promise<Response>, opts: { advance?: boolean } = {}) {
  const audio = new FakeAudio();
  const events: string[] = [];
  let calls = 0;
  const fetchFn = (async (_u: string, init: RequestInit) => handler(calls++, JSON.parse(String(init.body)).text)) as unknown as typeof fetch;
  // With advance the fake clock jumps whenever the speaker waits; without it the test moves the clock itself.
  const wait = opts.advance === false ? async () => tick() : async (ms: number) => void (audio.currentTime += ms / 1000);
  const speaker = new CloudSpeaker('s_test', 'pl', 'voice0000001', {
    audio,
    fetchFn,
    wait,
    browser: async (t) => void events.push(`browser:${t}@${audio.currentTime.toFixed(2)}`),
    cancelBrowser: () => events.push('cancelBrowser'),
  });
  speaker.onStart = () => events.push('start');
  speaker.onIdle = () => events.push('idle');
  speaker.onFallback = (c) => events.push(`fallback:${c}`);
  return { audio, events, speaker, calls: () => calls };
}

test('sentences play back to back with no gap, start once, and the turn ends when it was heard', async () => {
  const r = rig(() => audioResponse(1));
  r.speaker.say('Pierwsze zdanie.');
  r.speaker.say('Drugie zdanie.');
  r.speaker.finish();
  await until(() => r.events.includes('idle'), 'idle');
  const [first, ...rest] = r.audio.played;
  const end = r.audio.played.at(-1)!.start + r.audio.played.at(-1)!.duration;
  assert.ok(first!.start >= 0.03);
  for (let i = 0; i < rest.length; i++) {
    const prev = r.audio.played[i]!;
    assert.ok(Math.abs(prev.start + prev.duration - r.audio.played[i + 1]!.start) < 1e-9, `piece ${i + 1} follows piece ${i} exactly`);
  }
  assert.ok(Math.abs(end - first!.start - 2) < 0.01, 'two seconds of audio in total');
  assert.deepEqual(r.events.filter((e) => e === 'start' || e === 'idle'), ['start', 'idle']);
  assert.ok(r.audio.currentTime >= end - 0.01, 'idle only after the audio had played');
});

test('a sentence cut in half over odd byte boundaries has the full length', async () => {
  const r = rig(() => audioResponse(1, 1001));
  r.speaker.say('Jedno zdanie.');
  r.speaker.finish();
  await until(() => r.events.includes('idle'), 'idle');
  const total = r.audio.played.reduce((s, p) => s + p.duration, 0);
  assert.ok(Math.abs(total - 1) < 1e-6, `got ${total}`);
});

test('when the user cuts in, only the words that had played are counted, and cancel stops the audio', async () => {
  const r = rig(() => audioResponse(2), { advance: false });
  r.speaker.say('Jeden dwa trzy cztery pięć sześć siedem osiem');
  await until(() => r.audio.played.length >= 8, 'two seconds of audio scheduled');
  const start = r.audio.played[0]!.start;
  assert.equal(r.speaker.spokenText, '', 'nothing has played yet');
  r.audio.currentTime = start + 1;
  assert.equal(r.speaker.spokenText, 'Jeden dwa trzy cztery');
  r.speaker.cancel();
  assert.ok(r.audio.played.every((p) => p.stopped));
  assert.equal(r.speaker.busy, false);
  assert.ok(!r.events.includes('idle'), 'a cancelled turn does not report that it ended');
});

test('when the voice fails, the browser voice speaks that sentence after the audio before it, and the rest too', async () => {
  const r = rig((n) => (n === 0 ? audioResponse(1) : new Response(JSON.stringify({ code: 'limit' }), { status: 429 })));
  r.speaker.say('Pierwsze.');
  r.speaker.say('Drugie.');
  r.speaker.say('Trzecie.');
  r.speaker.finish();
  await until(() => r.events.includes('idle'), 'idle');
  const first = r.audio.played[0]!;
  const browser = r.events.filter((e) => e.startsWith('browser:'));
  assert.deepEqual(browser.map((e) => e.split('@')[0]), ['browser:Drugie.', 'browser:Trzecie.']);
  assert.ok(Number(browser[0]!.split('@')[1]) >= first.start + first.duration - 0.01, 'after the first sentence was heard');
  assert.deepEqual(r.events.filter((e) => e.startsWith('fallback')), ['fallback:limit'], 'reported once');
  assert.match(r.speaker.spokenText, /Pierwsze\. Drugie\. Trzecie\./);
});

test('after a failure no more requests are made', async () => {
  const r = rig(() => new Response('{"code":"quota"}', { status: 429 }));
  r.speaker.say('Raz.');
  r.speaker.finish();
  await until(() => r.events.includes('idle'), 'first turn');
  const before = r.calls();
  r.speaker.reset();
  r.speaker.say('Dwa.');
  r.speaker.finish();
  await until(() => r.events.filter((e) => e === 'idle').length === 2, 'second turn');
  assert.equal(r.calls(), before, 'the second turn went straight to the browser voice');
  assert.ok(r.events.some((e) => e.startsWith('browser:Dwa.')));
});

test('a browser that will not start audio falls back to its own voice instead of hanging', async () => {
  const r = rig(() => audioResponse(1));
  r.audio.state = 'suspended';
  r.audio.resume = async () => {};
  r.speaker.say('Halo.');
  r.speaker.finish();
  await until(() => r.events.includes('idle'), 'idle');
  assert.deepEqual(r.events.filter((e) => e.startsWith('fallback')), ['fallback:audio']);
  assert.ok(r.events.some((e) => e.startsWith('browser:Halo.')));
  assert.equal(r.audio.played.length, 0);
});

test('a new turn after a cancel plays normally', async () => {
  const r = rig(() => audioResponse(1));
  r.speaker.say('Stare.');
  r.speaker.cancel();
  r.speaker.reset();
  r.speaker.say('Nowe.');
  r.speaker.finish();
  await until(() => r.events.includes('idle'), 'idle');
  assert.equal(r.events.filter((e) => e === 'idle').length, 1);
  assert.ok(r.audio.played.some((p) => !p.stopped));
});

test('finish with nothing said ends the turn at once', () => {
  const r = rig(() => audioResponse(1));
  r.speaker.finish();
  assert.deepEqual(r.events, ['idle']);
});
