import assert from 'node:assert/strict';
import { test } from 'node:test';
import { measureDelivery } from '../shared/audit.ts';

test('delivery metrics are measured, not guessed', () => {
  const m = measureDelivery(
    [
      { role: 'bot', text: 'Speaking.', at: 0 },
      { role: 'user', text: 'Um, I basically help companies, you know, with websites.', at: 5000 },
      { role: 'bot', text: 'What exactly? —', at: 8000 },
      { role: 'user', text: 'Your site takes seven seconds to load.', at: 12000 },
    ],
    20000,
    false,
  );
  assert.equal(m.userTurns, 2);
  assert.equal(m.userWords, 16);
  assert.equal(m.fillerCount, 3);
  assert.equal(m.interruptions, 1);
  assert.equal(m.longestTurnWords, 9);
  assert.equal(m.durationSec, 20);
});
