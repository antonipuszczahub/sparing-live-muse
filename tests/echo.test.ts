import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ECHO_TAIL_MS, isBotEcho } from '../src/engine/echo.ts';

const BOT = 'Six months is a trial, not a business. What happens when it ends?';

test('while the character speaks, a transcript with fewer than two new words is its own voice', () => {
  assert.equal(isBotEcho('speaking', 0, 'six months is a trial', BOT, 'en'), true);
  assert.equal(isBotEcho('speaking', 0, 'trial', BOT, 'en'), true);
  assert.equal(isBotEcho('speaking', 0, 'wait, let me finish the pilot numbers', BOT, 'en'), false);
});

test('just after it stops, the tail of its own line is echo, a real answer is not', () => {
  assert.equal(isBotEcho('listening', 500, 'what happens when it ends', BOT, 'en'), true);
  assert.equal(isBotEcho('listening', 500, 'It converts to a yearly plan if the clinic hits the target', BOT, 'en'), false);
});

test('short answers are never echo, and the echo window closes', () => {
  assert.equal(isBotEcho('listening', 200, 'yes', BOT, 'en'), false);
  assert.equal(isBotEcho('listening', 200, 'yes it ends', BOT, 'en'), false);
  assert.equal(isBotEcho('listening', ECHO_TAIL_MS + 1, 'what happens when it ends', BOT, 'en'), false);
});

test('other phases are never judged as echo', () => {
  assert.equal(isBotEcho('thinking', 0, 'what happens when it ends', BOT, 'en'), false);
  assert.equal(isBotEcho('connecting', 0, 'hello there friend', BOT, 'en'), false);
  assert.equal(isBotEcho('ended', 0, 'what happens when it ends', BOT, 'en'), false);
});

test('it works in Polish too', () => {
  const pl = 'Halo, jesteś tam? Połączenie jakby zamarło.';
  assert.equal(isBotEcho('listening', 300, 'halo jesteś tam połączenie jakby zamarło', pl, 'pl'), true);
  assert.equal(isBotEcho('listening', 300, 'tak jestem, mówiłem o cenie', pl, 'pl'), false);
});
