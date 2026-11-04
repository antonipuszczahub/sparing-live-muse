import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { hasSeenAbout, markAboutSeen } from '../src/lib/seen.ts';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const g = globalThis as unknown as { localStorage?: Store };
const original = g.localStorage;
beforeEach(() => {
  const data = new Map<string, string>();
  g.localStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
});
afterEach(() => {
  g.localStorage = original;
});

test('a first visit has not seen the Demo panel, and opening it is remembered', () => {
  assert.equal(hasSeenAbout(), false);
  markAboutSeen();
  assert.equal(hasSeenAbout(), true);
});

test('with blocked storage the start screen does not nudge on every visit', () => {
  g.localStorage = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  assert.equal(hasSeenAbout(), true);
  assert.doesNotThrow(() => markAboutSeen());
});
