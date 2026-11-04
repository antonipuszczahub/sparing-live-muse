import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PTT_RELEASE_MS, TalkGate } from '../src/lib/ptt.ts';

/** A clock the test moves by hand. */
function fakeClock() {
  let now = 0;
  let next = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();
  return {
    set: (fn: () => void, ms: number) => {
      const id = next++;
      pending.set(id, { at: now + ms, fn });
      return id;
    },
    clear: (h: unknown) => void pending.delete(h as number),
    advance(ms: number) {
      now += ms;
      for (const [id, t] of [...pending]) if (t.at <= now) (pending.delete(id), t.fn());
    },
    get waiting() {
      return pending.size;
    },
  };
}

function setup() {
  const calls: boolean[] = [];
  const clock = fakeClock();
  const gate = new TalkGate((m) => calls.push(m), PTT_RELEASE_MS, clock);
  return { calls, clock, gate };
}

test('the microphone starts muted, opens on press and closes only after the release delay', () => {
  const { calls, clock, gate } = setup();
  gate.start();
  gate.press();
  gate.release();
  assert.deepEqual(calls, [true, false], 'still open right after the release: the last words are being transcribed');
  clock.advance(PTT_RELEASE_MS - 1);
  assert.deepEqual(calls, [true, false]);
  clock.advance(1);
  assert.deepEqual(calls, [true, false, true]);
});

test('pressing again inside the delay keeps the microphone open and cancels the pending mute', () => {
  const { calls, clock, gate } = setup();
  gate.press();
  gate.release();
  clock.advance(400);
  gate.press();
  assert.equal(clock.waiting, 0);
  clock.advance(5000);
  assert.deepEqual(calls, [false, false], 'never muted in between');
  gate.release();
  clock.advance(PTT_RELEASE_MS);
  assert.deepEqual(calls, [false, false, true]);
});

test('repeated releases restart the delay instead of stacking, and dispose cancels it', () => {
  const { calls, clock, gate } = setup();
  gate.press();
  gate.release();
  clock.advance(500);
  gate.release();
  assert.equal(clock.waiting, 1);
  clock.advance(500);
  assert.deepEqual(calls, [false], 'the first delay was replaced');
  clock.advance(400);
  assert.deepEqual(calls, [false, true]);
  gate.press();
  gate.release();
  gate.dispose();
  clock.advance(10_000);
  assert.deepEqual(calls, [false, true, false], 'a disposed gate does not touch the engine later');
});
