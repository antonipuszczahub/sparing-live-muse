import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { FILLERS, FILLER_AFTER_MS, FILLER_GAP, FILLER_MIN_WORDS, pickFiller, wantsFiller, withoutFiller } from '../src/engine/filler.ts';
import { takeFirstClause, takeSentences } from '../src/lib/text.ts';
import { flush, installClock, restoreClock, rig, type Rig } from './engineRig.ts';

beforeEach(installClock);
afterEach(restoreClock);

const SLOW = FILLER_AFTER_MS + 20;
const SAID = 'Chciałbym omówić warunki tej oferty'; // six words

/** The user says something and the model is slow: the reply is held back until `release` is called. */
function slowReply(r: Rig) {
  let release!: (s: string) => void;
  r.answers.push(new Promise<string>((res) => (release = res)));
  return (s: string) => release(s);
}

// ---- the pure parts ---------------------------------------------------------------------------------------------------

test('fillers: both languages have a few, they rotate, and only a real sentence from the user earns one', () => {
  for (const lang of ['en', 'pl'] as const) {
    assert.ok(FILLERS[lang].length >= 5);
    assert.notEqual(pickFiller(lang, 3), pickFiller(lang, 4), 'two turns in a row never get the same one');
    assert.ok(FILLERS[lang].every((f) => f.split(' ').length <= 2 && f.length <= 12), 'a filler is a breath, not a sentence');
  }
  assert.equal(pickFiller('pl', FILLERS.pl.length + 2), pickFiller('pl', 2), 'the rotation wraps');
  assert.equal(wantsFiller('Tak, dobrze', FILLER_GAP), false, 'a two-word answer is answered quickly: no filler');
  assert.equal(wantsFiller(SAID, FILLER_GAP - 1), false, 'not twice in a row');
  assert.equal(wantsFiller(SAID, FILLER_GAP), true);
  assert.ok(SAID.split(' ').length >= FILLER_MIN_WORDS);
  assert.equal(wantsFiller('', 99), false);
});

test('a reply that opens with the same acknowledgement loses it, so the user never hears "Hm. Hm."', () => {
  assert.equal(withoutFiller('No tak. Ile to kosztuje?', 'No tak.'), 'Ile to kosztuje?');
  assert.equal(withoutFiller('Hm, ile to kosztuje?', 'Hm.'), 'ile to kosztuje?');
  assert.equal(withoutFiller('Hm.', 'Hm.'), '', 'a sentence that is only the filler is dropped');
  assert.equal(withoutFiller('Hmm, ile to kosztuje?', 'Hm.'), 'Hmm, ile to kosztuje?', 'a different word is kept');
  assert.equal(withoutFiller('Rozumiem. Ile to kosztuje?', 'Hm.'), 'Rozumiem. Ile to kosztuje?');
  assert.equal(withoutFiller('Ile to kosztuje?', ''), 'Ile to kosztuje?', 'no filler said: nothing to remove');
  assert.equal(withoutFiller('Mhm. Dalej.', 'Mhm.'), 'Dalej.');
});

test('the first clause is spoken before the sentence ends, but never a stub and never inside a number', () => {
  assert.deepEqual(takeFirstClause('Rozumiem, ale proszę mówić konkretnie, ile to kosztuje?'), {
    clause: 'Rozumiem, ale proszę mówić konkretnie,',
    rest: 'ile to kosztuje?',
  });
  assert.equal(takeFirstClause('Rozumiem, ale proszę mówić konkretnie,'), null, 'nothing follows the comma yet: it may still be part of a number');
  assert.equal(takeFirstClause('Niesamowicie, wspaniale, to jest dobre'), null, 'two words are a stub, not a clause');
  assert.equal(takeFirstClause('Hm, tak, ok, ')?.clause ?? null, null, 'and a few short syllables are shorter than a breath');
  assert.equal(takeFirstClause('Ile to kosztuje?'), null, 'no clause break: the whole sentence is spoken when it ends');
  assert.deepEqual(takeFirstClause('To jest 3,5 procent, prawda? Tak.'), { clause: 'To jest 3,5 procent,', rest: 'prawda? Tak.' }, 'a decimal comma is not a break');
  assert.deepEqual(takeSentences('Dobrze. Ile'), { sentences: ['Dobrze.'], rest: 'Ile' }, 'sentences still work as before');
});

// ---- the engine -------------------------------------------------------------------------------------------------------

test('a slow model: after about two thirds of a second the character says a short acknowledgement, then the reply follows', async () => {
  const r = await rig(2);
  const release = slowReply(r);
  r.ears.onFinal(SAID, 0);
  await flush();
  assert.equal(r.voice.said.length, 0, 'nothing yet: the model may still be quick');
  mock.timers.tick(SLOW);
  assert.deepEqual(r.voice.said, [pickFiller('pl', 1)], 'one filler, from the Polish list');
  assert.equal(r.last().state, 'speaking');
  release('Ile to kosztuje?');
  await flush();
  assert.deepEqual(r.voice.said, [pickFiller('pl', 1), 'Ile to kosztuje?']);
  r.voice.end();
  await flush();
  const bot = r.last().turns.filter((t) => t.role === 'bot');
  assert.equal(bot.at(-1)!.text, `${pickFiller('pl', 1)} Ile to kosztuje?`, 'the transcript has what was heard, in order');
  assert.equal(r.last().state, 'listening');
  r.engine.dispose();
});

test('a quick model: the timer is cancelled by its first word and no filler is spoken', async () => {
  const r = await rig(2);
  r.answers.push('Ile to kosztuje?');
  r.ears.onFinal(SAID, 0);
  await flush();
  mock.timers.tick(SLOW * 3);
  assert.deepEqual(r.voice.said, ['Ile to kosztuje?']);
  r.voice.end();
  await flush();
  assert.equal(r.last().turns.filter((t) => t.role === 'bot').at(-1)!.text, 'Ile to kosztuje?');
  r.engine.dispose();
});

test('a short answer from the user, and the character\'s own silence-breaking line, never get a filler', async () => {
  const r = await rig(2);
  const release = slowReply(r);
  r.ears.onFinal('Tak, dobrze', 0);
  await flush();
  mock.timers.tick(SLOW);
  assert.equal(r.voice.said.length, 0, 'two words');
  release('Świetnie.');
  await flush();
  r.voice.end();
  await flush();

  // the user says nothing for a long time: the character speaks up by itself, and that is not an answer to anything
  const silent = slowReply(r);
  mock.timers.tick(60_000);
  await flush();
  assert.equal(r.requests.length, 3, 'the character did speak up by itself');
  mock.timers.tick(SLOW);
  assert.equal(r.voice.said.length, 0, 'no filler for a line that answers nothing');
  silent('Halo, jest Pan tam?');
  await flush();
  r.engine.dispose();
});

test('not two exchanges in a row: the next filler comes only after a gap', async () => {
  const r = await rig(2);
  const exchange = async (user: string, reply: string) => {
    const release = slowReply(r);
    r.ears.onFinal(user, 0);
    await flush();
    mock.timers.tick(SLOW);
    const heard = r.voice.said.length > 0;
    release(reply);
    await flush();
    r.voice.end();
    await flush();
    return heard;
  };
  assert.equal(await exchange(SAID, 'Ile to kosztuje?'), true);
  assert.equal(await exchange('Zaraz wyślę Panu wszystkie szczegóły', 'Dobrze, czekam.'), false, 'the next exchange is answered without one');
  assert.equal(await exchange('Cena to dwanaście tysięcy złotych netto', 'To sporo.'), true, 'and the one after that may have one again');
  r.engine.dispose();
});

test('a reply that starts with the filler already spoken is not said twice, in speech or in the transcript', async () => {
  const r = await rig(2);
  const f = pickFiller('pl', 1);
  const release = slowReply(r);
  r.ears.onFinal(SAID, 0);
  await flush();
  mock.timers.tick(SLOW);
  release(`${f} Ile to kosztuje?`);
  await flush();
  assert.deepEqual(r.voice.said, [f, 'Ile to kosztuje?']);
  r.voice.end();
  await flush();
  assert.equal(r.last().turns.filter((t) => t.role === 'bot').at(-1)!.text, `${f} Ile to kosztuje?`);
  r.engine.dispose();
});

test('talking over a lone filler is a barge-in like any other, and the filler is not recorded as a turn', async () => {
  const r = await rig(2);
  const release = slowReply(r);
  r.ears.onFinal(SAID, 0);
  await flush();
  mock.timers.tick(SLOW);
  assert.equal(r.voice.said.length, 1);
  r.ears.onInterim('zupełnie inne słowa teraz mówię');
  await flush();
  assert.ok(r.voice.cancelled > 0, 'the voice was cut');
  release('Ile to kosztuje?');
  await flush();
  assert.deepEqual(
    r.last().turns.filter((t) => t.role === 'bot').map((t) => t.text),
    ['Halo?'],
    'no "No tak. —" turn, and the late reply of the abandoned turn is dropped',
  );
  r.engine.dispose();
});

test('hanging up while only the filler has been said leaves no turn behind', async () => {
  const r = await rig(2);
  slowReply(r);
  r.ears.onFinal(SAID, 0);
  await flush();
  mock.timers.tick(SLOW);
  r.engine.hangUp();
  assert.deepEqual(r.last().turns.filter((t) => t.role === 'bot').map((t) => t.text), ['Halo?']);
  assert.equal(r.last().state, 'ended');
});

test('the latency shown is the time to the real first word, not to the filler', async () => {
  const r = await rig(2);
  const release = slowReply(r);
  r.ears.onFinal(SAID, 0);
  await flush();
  mock.timers.tick(SLOW);
  assert.equal(r.last().lastLatencyMs, undefined, 'the filler is not the answer');
  mock.timers.tick(800);
  release('Ile to kosztuje?');
  await flush();
  assert.ok((r.last().lastLatencyMs ?? 0) >= SLOW + 800, `got ${r.last().lastLatencyMs}`);
  r.engine.dispose();
});

test('the first clause of a long sentence is spoken as its own piece, and a short sentence is one piece', async () => {
  const r = await rig(2);
  r.answers.push('Rozumiem, ale proszę mówić konkretnie, ile to kosztuje?');
  r.ears.onFinal(SAID, 0);
  await flush();
  assert.deepEqual(r.voice.said, ['Rozumiem, ale proszę mówić konkretnie,', 'ile to kosztuje?']);
  r.voice.end();
  await flush();
  assert.equal(r.last().turns.filter((t) => t.role === 'bot').at(-1)!.text, 'Rozumiem, ale proszę mówić konkretnie, ile to kosztuje?', 'the transcript has the reply whole');
  r.answers.push('Ile to kosztuje?');
  r.ears.onFinal('A teraz konkretnie: dwanaście tysięcy złotych', 0);
  await flush();
  assert.deepEqual(r.voice.said, ['Ile to kosztuje?']);
  r.engine.dispose();
});
