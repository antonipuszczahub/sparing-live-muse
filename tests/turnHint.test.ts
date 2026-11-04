import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { Turn } from '../shared/types.ts';
import { CLOSE_AFTER_ONE, endsAsking, roll, turnHint } from '../server/agents/turnHint.ts';

afterEach(() => {
  delete process.env.TURN_HINT;
});

const bot = (text: string): Turn => ({ role: 'bot', text, at: 0 });
const user = (text: string): Turn => ({ role: 'user', text, at: 0 });

test('there is no hint for the opening line or before the user has said anything', () => {
  assert.equal(turnHint([], 'en', 1), undefined);
  assert.equal(turnHint([bot('Hello?')], 'en', 1), undefined);
  assert.equal(turnHint([user('Hi')], 'en', 1), undefined);
});

test('a question mark at the end is a question, also when the line was cut off', () => {
  assert.equal(endsAsking('How much?'), true);
  assert.equal(endsAsking('How much? —'), true);
  assert.equal(endsAsking('That is a lot. I disagree.'), false);
  assert.equal(endsAsking('Who pays? You do not know.'), false);
});

test('after two questions in a row the next turn is closed to questions, always', () => {
  const h = [bot('Hello?'), user('Hi, I sell sites.'), bot('Who for?'), user('Clinics.'), bot('How many?'), user('Two.')];
  for (let seed = 0; seed < 50; seed++) assert.match(turnHint(h, 'en', seed)!, /do NOT ask a question/);
});

test('after one question it is closed about as often as CLOSE_AFTER_ONE says, and the same for the same call', () => {
  const h = [bot('Hello.'), user('Hi, I sell sites.'), bot('Who for?'), user('Clinics.')];
  let closed = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const a = turnHint(h, 'en', seed);
    assert.equal(a, turnHint(h, 'en', seed), 'deterministic for one call and turn');
    if (a?.includes('do NOT ask')) closed++;
  }
  assert.ok(Math.abs(closed / 400 - CLOSE_AFTER_ONE) < 0.1, `closed ${closed} of 400`);
});

test('after a statement the question stays open, and the next line is asked to start differently', () => {
  const h = [bot('Hello.'), user('Hi, I sell sites.'), bot('Right, and I get ten of those a week.'), user('Mine is faster.')];
  const hint = turnHint(h, 'en', 7)!;
  assert.ok(!hint.includes('do NOT ask'));
  assert.match(hint, /began with “right”/);
});

test('the Polish hint is in Polish, and square-bracket notes from the simulator do not count as the user', () => {
  const h = [bot('Halo?'), user('Dzień dobry.'), bot('W jakiej sprawie?'), user('Strony internetowe.'), bot('Dla kogo?'), user('[the user has been silent for a while]')];
  assert.match(turnHint(h, 'pl', 3)!, /NIE zadawaj pytania/);
  assert.match(turnHint(h, 'pl', 3)!, /zaczynała się od „dla”/);
  assert.equal(turnHint([bot('Halo?'), user('[the user has been silent for a while]')], 'pl', 3), undefined);
});

test('TURN_HINT=off switches it off, and roll stays in [0, 1)', () => {
  const h = [bot('Hello.'), user('Hi.'), bot('Who?'), user('Me.'), bot('Why?'), user('Because.')];
  process.env.TURN_HINT = 'off';
  assert.equal(turnHint(h, 'en', 1), undefined);
  for (let i = 0; i < 200; i++) {
    const r = roll(i * 7919, i);
    assert.ok(r >= 0 && r < 1);
  }
});

test('the hint travels as a note after the conversation, and the system prompt and history are left exactly as they were', async () => {
  const { withHint } = await import('../server/agents/persona.ts');
  const base = [
    { role: 'system' as const, content: 'You are Dana.' },
    { role: 'user' as const, content: 'Hi.' },
  ];
  const out = withHint(base, 'This turn do NOT ask a question.');
  assert.equal(out.length, 3);
  assert.deepEqual(out.slice(0, 2), base, 'the cached start of the prompt is untouched');
  assert.equal(out[2]!.role, 'user');
  assert.match(out[2]!.content as string, /^\[Note for you only\..*do NOT ask a question\.\]$/);
  assert.equal(base.length, 2, 'the original list is not changed');
  assert.equal(withHint(base, undefined), base, 'no hint, no change');
});
