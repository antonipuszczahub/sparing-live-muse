import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ECHO_SIGNS_BEFORE_HINT, ECHO_TAIL_MS, EARLY_BARGE_MS, EchoWatch, isBotEcho, micClosedForTurnTaking, TURN_TAKING_TAIL_MS } from '../src/engine/echo.ts';
import { ARCHETYPE_GENDER, archetypeFor } from '../src/lib/archetype.ts';

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

test('the headphones hint waits for several signs of echo', () => {
  const w = new EchoWatch();
  assert.equal(w.suspected, false);
  w.filtered();
  w.bargeIn(EARLY_BARGE_MS - 1);
  assert.equal(w.suspected, false, 'a filtered transcript and a quick interruption can be chance or a person');
  w.filtered();
  assert.equal(w.suspected, true);
  assert.equal(ECHO_SIGNS_BEFORE_HINT, 3);
});

test('a barge-in well into the character\'s line is a person talking, not a sign of echo', () => {
  const w = new EchoWatch();
  for (let i = 0; i < ECHO_SIGNS_BEFORE_HINT + 3; i++) w.bargeIn(EARLY_BARGE_MS + 500 * (i + 1));
  assert.equal(w.suspected, false);
});

test('a person who deliberately cuts in quickly once or twice does not trigger it', () => {
  const w = new EchoWatch();
  w.bargeIn(200);
  w.bargeIn(900);
  assert.equal(w.suspected, false);
  w.bargeIn(500);
  assert.equal(w.suspected, true, 'but three almost instant barge-ins in one call look like the character hearing itself');
});

test('it works in Polish too', () => {
  const pl = 'Halo, jesteś tam? Połączenie jakby zamarło.';
  assert.equal(isBotEcho('listening', 300, 'halo jesteś tam połączenie jakby zamarło', pl, 'pl'), true);
  assert.equal(isBotEcho('listening', 300, 'tak jestem, mówiłem o cenie', pl, 'pl'), false);
});

test('taking turns closes the microphone only while the character speaks, and holding the cut-in key opens it', () => {
  assert.equal(micClosedForTurnTaking('speaking', true, false), true);
  assert.equal(micClosedForTurnTaking('speaking', true, true), false, 'the user cuts in on purpose');
  assert.equal(micClosedForTurnTaking('speaking', false, false), false, 'until echo is suspected the microphone is never closed');
  for (const phase of ['connecting', 'listening', 'thinking', 'ended'] as const) assert.equal(micClosedForTurnTaking(phase, true, false), false, phase);
  assert.ok(TURN_TAKING_TAIL_MS >= 300 && TURN_TAKING_TAIL_MS <= 1500, 'a short tail: long enough for the last words, short enough to answer at once');
});

test("the stand-in photograph is of a person of the character's gender", () => {
  for (const scenario of ['sales', 'defense', 'salary', 'pitch'] as const) {
    for (const gender of ['m', 'f'] as const) assert.equal(ARCHETYPE_GENDER[archetypeFor(scenario, gender)], gender, `${scenario} ${gender}`);
    assert.equal(archetypeFor(scenario, ARCHETYPE_GENDER[scenario]), scenario, 'the scenario keeps its own photograph when the gender fits');
    assert.equal(archetypeFor(scenario), scenario, 'no gender known: the scenario photograph');
  }
  assert.notEqual(archetypeFor('sales', 'f'), 'sales', 'a woman in a sales call is not the man of the sales photograph');
});
