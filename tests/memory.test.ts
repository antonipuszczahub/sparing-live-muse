import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { clearWeakSpots, recordWeakSpots, topWeakSpots } from '../src/lib/memory.ts';
import { loadUser, saveUser } from '../src/lib/profile.ts';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const g = globalThis as unknown as { localStorage?: Store };
const original = g.localStorage;

function fakeStorage(): Store & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

let store = fakeStorage();
beforeEach(() => {
  store = fakeStorage();
  g.localStorage = store;
});
afterEach(() => {
  g.localStorage = original;
});

test('weak spots add up across calls and the most frequent comes first', (t) => {
  // calls are minutes apart in real use; a ticking clock keeps "most recent" well defined here
  let clock = 1_000;
  t.mock.method(Date, 'now', () => (clock += 1_000));
  recordWeakSpots(['vague on price', 'ignored objection']);
  recordWeakSpots(['vague on price']);
  recordWeakSpots(['vague on price', 'talked over the other person']);
  assert.deepEqual(topWeakSpots(2), ['vague on price', 'talked over the other person'], 'count first, then the most recent');
  assert.deepEqual(topWeakSpots(1), ['vague on price']);
});

test('tags are normalised: trimmed, lower case, capped, empties dropped', () => {
  recordWeakSpots(['  Vague On Price ', 'vague on price', '', '   ', 'x'.repeat(100)]);
  const top = topWeakSpots(5);
  assert.equal(top[0], 'vague on price');
  assert.equal(top.length, 2);
  assert.equal(top[1]!.length, 60);
});

test('each language keeps its own list, and the list can be cleared', () => {
  recordWeakSpots(['vague on price'], 'en');
  recordWeakSpots(['niejasno o cenie'], 'pl');
  assert.deepEqual(topWeakSpots(3, 'en'), ['vague on price']);
  assert.deepEqual(topWeakSpots(3, 'pl'), ['niejasno o cenie']);
  clearWeakSpots('pl');
  assert.deepEqual(topWeakSpots(3, 'pl'), []);
  assert.deepEqual(topWeakSpots(3, 'en'), ['vague on price'], 'the other language is untouched');
});

test('only the 30 most recent weak spots are kept', () => {
  recordWeakSpots(Array.from({ length: 40 }, (_, i) => `tag ${i}`));
  const kept = JSON.parse(store.data.get('sl.weak.v1')!) as unknown[];
  assert.equal(kept.length, 30);
});

test('broken or blocked storage never breaks the app', () => {
  store.data.set('sl.weak.v1', '{not json');
  assert.deepEqual(topWeakSpots(), []);
  g.localStorage = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  assert.deepEqual(topWeakSpots(), []);
  assert.doesNotThrow(() => recordWeakSpots(['anything']));
  assert.doesNotThrow(() => saveUser({ gender: 'f', formal: true }));
  assert.deepEqual(loadUser(), { gender: 'm', formal: false });
});

test('the user profile round-trips and falls back to the default for anything else', () => {
  assert.deepEqual(loadUser(), { gender: 'm', formal: false }, 'nothing saved yet');
  saveUser({ gender: 'f', formal: true });
  assert.deepEqual(loadUser(), { gender: 'f', formal: true });
  store.data.set('sl.user.v1', JSON.stringify({ gender: 'x', formal: true }));
  assert.deepEqual(loadUser(), { gender: 'm', formal: false }, 'an unknown gender is not accepted');
  store.data.set('sl.user.v1', '[[');
  assert.deepEqual(loadUser(), { gender: 'm', formal: false }, 'corrupt data is ignored');
});
