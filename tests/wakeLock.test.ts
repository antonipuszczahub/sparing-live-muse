import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keepAwake } from '../src/lib/wakeLock.ts';

function fakes(opts: { reject?: boolean } = {}) {
  const log: string[] = [];
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: 'visible',
    addEventListener: (_t: 'visibilitychange', l: () => void) => void listeners.add(l),
    removeEventListener: (_t: 'visibilitychange', l: () => void) => void listeners.delete(l),
  };
  const host = {
    wakeLock: {
      request: async () => {
        log.push('request');
        if (opts.reject) throw new Error('denied');
        return { release: async () => void log.push('release') };
      },
    },
  };
  return { log, listeners, doc, host };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test('the screen lock is requested at the start and released at the end', async () => {
  const f = fakes();
  const stop = keepAwake(f.host, f.doc);
  await tick();
  assert.deepEqual(f.log, ['request']);
  stop();
  await tick();
  assert.deepEqual(f.log, ['request', 'release']);
  assert.equal(f.listeners.size, 0, 'the listener is removed');
});

test('it is asked for again when the tab comes back, and not while it is hidden', async () => {
  const f = fakes();
  const stop = keepAwake(f.host, f.doc);
  await tick();
  f.doc.visibilityState = 'hidden';
  f.listeners.forEach((l) => l()); // the browser dropped the lock; hidden: nothing to ask
  await tick();
  assert.deepEqual(f.log, ['request']);
  f.doc.visibilityState = 'visible';
  f.listeners.forEach((l) => l());
  await tick();
  assert.deepEqual(f.log, ['request', 'request']);
  stop();
});

test('a lock that arrives after the call ended is let go, and a missing or refusing API is harmless', async () => {
  const f = fakes();
  const stop = keepAwake(f.host, f.doc);
  stop(); // before the request resolved
  await tick();
  assert.deepEqual(f.log, ['request', 'release']);

  assert.doesNotThrow(() => keepAwake({}, fakes().doc)());
  assert.doesNotThrow(() => keepAwake(undefined, undefined)());
  const refused = fakes({ reject: true });
  const end = keepAwake(refused.host, refused.doc);
  await tick();
  assert.doesNotThrow(end);
});
