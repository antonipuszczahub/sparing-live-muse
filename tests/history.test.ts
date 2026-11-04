import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { clearRuns, loadRuns, recentRuns, recordRun, sparkline } from '../src/lib/history.ts';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const g = globalThis as unknown as { localStorage?: Store };
const original = g.localStorage;
let data = new Map<string, string>();

beforeEach(() => {
  data = new Map();
  g.localStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
});
afterEach(() => {
  g.localStorage = original;
});

const run = (score: number, t = score) => ({ t, score, scenario: 'pitch' as const, level: 2 as const });

test('scores are kept in order, clamped to 0-100 and rounded, per language', () => {
  recordRun(run(41.6), 'en');
  recordRun(run(150), 'en');
  recordRun(run(-5), 'en');
  recordRun(run(70), 'pl');
  assert.deepEqual(loadRuns('en').map((r) => r.score), [42, 100, 0]);
  assert.deepEqual(loadRuns('pl').map((r) => r.score), [70]);
});

test('only the last thirty runs are kept and recentRuns returns the newest, oldest first', () => {
  for (let i = 1; i <= 40; i++) recordRun(run(i), 'en');
  assert.equal(loadRuns('en').length, 30);
  assert.deepEqual(recentRuns('en', 3).map((r) => r.score), [38, 39, 40]);
});

test('the history can be cleared, and broken or blocked storage gives an empty one', () => {
  recordRun(run(50), 'en');
  clearRuns('en');
  assert.deepEqual(loadRuns('en'), []);
  data.set('sl.runs.v1', '{broken');
  assert.deepEqual(loadRuns('en'), []);
  data.set('sl.runs.v1', JSON.stringify([{ score: 'x' }, { t: 1, score: 60, scenario: 'sales', level: 1 }]));
  assert.equal(loadRuns('en').length, 1, 'rows that are not scores are dropped');
  g.localStorage = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };
  assert.deepEqual(loadRuns('en'), []);
  assert.doesNotThrow(() => recordRun(run(50), 'en'));
  assert.doesNotThrow(() => clearRuns('en'));
});

test('the sparkline range follows the scores, so a modest climb is still a visible slope', () => {
  const flat = sparkline([60, 60, 60], 100, 40).split(' ').map((p) => Number(p.split(',')[1]));
  assert.equal(new Set(flat).size, 1, 'equal scores are a level line');
  const climb = sparkline([38, 63], 100, 40).split(' ').map((p) => Number(p.split(',')[1]));
  assert.ok(climb[0]! - climb[1]! > 15, `a climb of 25 points spans well over the 8 px it would on a 0-100 scale, got ${climb[0]! - climb[1]!}`);
});

test('a sparkline puts the best score at the top and the oldest on the left', () => {
  const pts = sparkline([0, 100], 100, 40, 4).split(' ').map((p) => p.split(',').map(Number) as [number, number]);
  assert.equal(pts[0]![0], 4);
  assert.equal(pts[1]![0], 96);
  assert.equal(pts[0]![1], 36, '0 is at the bottom');
  assert.equal(pts[1]![1], 4, '100 is at the top');
  assert.equal(sparkline([], 100, 40), '');
  assert.equal(sparkline([50], 100, 40).split(' ').length, 1, 'a single score is one point in the middle');
});
