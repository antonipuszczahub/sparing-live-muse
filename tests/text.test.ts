import assert from 'node:assert/strict';
import { test } from 'node:test';
import { novelWords, takeSentences } from '../src/lib/text.ts';

test('takeSentences waits for whitespace before cutting', () => {
  assert.deepEqual(takeSentences('It costs 3.5 dollars. And'), { sentences: ['It costs 3.5 dollars.'], rest: 'And' });
  assert.deepEqual(takeSentences('One. Two! Three?'), { sentences: ['One.', 'Two!'], rest: 'Three?' });
  assert.deepEqual(takeSentences('No end yet'), { sentences: [], rest: 'No end yet' });
});

test('echo of the bot is not new speech', () => {
  const bot = 'Seven seconds? Where did you test that?';
  assert.equal(novelWords('seven seconds where did you test that', bot).length, 0);
  assert.ok(novelWords('I measured it this morning on my phone', bot).length >= 2);
});
