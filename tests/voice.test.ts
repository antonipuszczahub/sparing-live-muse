import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNatural, pitchFor, rankVoices, sortVoices } from '../src/lib/tts.ts';

const v = (name: string, lang = 'pl-PL') => ({ name, lang });
const EDGE = [
  v('Microsoft Paulina - Polish (Poland)'),
  v('Microsoft Adam - Polish (Poland)'),
  v('Microsoft Marek Online (Natural) - Polish (Poland)'),
  v('Microsoft Zofia Online (Natural) - Polish (Poland)'),
];

test('Natural voices are recognised and listed first', () => {
  assert.equal(isNatural(EDGE[2]!), true);
  assert.equal(isNatural(EDGE[0]!), false);
  const sorted = sortVoices(EDGE).map((x) => x.name);
  assert.deepEqual(sorted.slice(0, 2), ['Microsoft Marek Online (Natural) - Polish (Poland)', 'Microsoft Zofia Online (Natural) - Polish (Poland)']);
});

test('a Natural voice of the right gender beats a basic one', () => {
  const woman = rankVoices(EDGE, 'pl', 'f');
  const man = rankVoices(EDGE, 'pl', 'm');
  assert.match(woman.voice!.name, /Zofia/);
  assert.match(man.voice!.name, /Marek/);
  assert.ok(woman.natural && woman.matched && man.natural && man.matched);
});

test('without Natural voices the basic ones are used, and a missing gender is flagged', () => {
  const basic = [v('Microsoft Paulina - Polish (Poland)')];
  const man = rankVoices(basic, 'pl', 'm');
  assert.match(man.voice!.name, /Paulina/);
  assert.equal(man.natural, false);
  assert.equal(man.matched, false, 'only a female voice exists, so the pitch is shifted');
  assert.equal(pitchFor(man.matched, 'm'), 0.8);
  assert.equal(pitchFor(true, 'm'), 1);
});

test('the voice the user chose wins, and a voice that has disappeared is ignored', () => {
  const chosen = rankVoices(EDGE, 'pl', 'f', 'Microsoft Paulina - Polish (Poland)');
  assert.match(chosen.voice!.name, /Paulina/);
  assert.equal(chosen.matched, true, 'the user decided, so no pitch shift');
  const gone = rankVoices(EDGE, 'pl', 'f', 'Voice That Was Uninstalled');
  assert.match(gone.voice!.name, /Zofia/);
});

test('English voices are ranked the same way and an empty list gives no voice', () => {
  const en = [v('Microsoft Zira - English (United States)', 'en-US'), v('Microsoft Guy Online (Natural) - English (United States)', 'en-US')];
  assert.match(rankVoices(en, 'en', 'm').voice!.name, /Guy/);
  assert.equal(rankVoices([], 'pl', 'f').voice, null);
});
