import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCENARIO_IDS } from '../shared/scenarios.ts';
import { rollVariant } from '../shared/variation.ts';

test('a seed replays the same character and day', () => {
  for (const id of SCENARIO_IDS) assert.deepEqual(rollVariant(id, 123), rollVariant(id, 123));
});

test('different seeds give different days', () => {
  for (const id of SCENARIO_IDS) {
    const days = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(rollVariant(id, i * 7919))));
    assert.ok(days.size > 20, `${id}: only ${days.size} distinct days in 40 calls`);
  }
});
