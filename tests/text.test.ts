import assert from 'node:assert/strict';
import { test } from 'node:test';
import { looksLikeEcho, novelWords, takeSentences } from '../src/lib/text.ts';

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

test('the tail of the bot line coming back is echo, a short or new answer is not', () => {
  const bot = 'Halo, jesteś tam? Połączenie jakby zamarło.';
  assert.equal(looksLikeEcho('halo jesteś tam połączenie jakby zamarło', bot, 'pl'), true);
  assert.equal(looksLikeEcho('Halo jesteś tam połączenie', bot, 'pl'), true);
  assert.equal(looksLikeEcho('tak', 'Czy to jest tak?', 'pl'), false);
  assert.equal(looksLikeEcho('tak jest', 'Czy to jest tak?', 'pl'), false);
  assert.equal(looksLikeEcho('Gabinety tracą dwadzieścia procent wizyt', bot, 'pl'), false);
  const en = 'Seven seconds? Where did you test that?';
  assert.equal(looksLikeEcho('seven seconds where did you test that', en), true);
  assert.equal(looksLikeEcho('I tested it on my phone this morning', en), false);
});
