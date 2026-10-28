import assert from 'node:assert/strict';
import { test } from 'node:test';
import { genderOf, isNatural, pitchFor, rankVoices, sortVoices, voicesFor } from '../src/lib/tts.ts';

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

test('each list offers only the voices that fit the character gender', () => {
  const all = [...EDGE, v('Some Unknown Voice')];
  const names = (g: 'm' | 'f') => voicesFor(all, 'pl', g).map((x) => x.name);
  assert.deepEqual(names('f'), ['Microsoft Paulina - Polish (Poland)', 'Microsoft Zofia Online (Natural) - Polish (Poland)', 'Some Unknown Voice']);
  assert.deepEqual(names('m'), ['Microsoft Adam - Polish (Poland)', 'Microsoft Marek Online (Natural) - Polish (Poland)', 'Some Unknown Voice']);
  assert.equal(genderOf(v('Microsoft Zira - English (United States)', 'en-US'), 'en'), 'f');
  assert.equal(genderOf(v('Microsoft David - English (United States)', 'en-US'), 'en'), 'm');
});

test('a character keeps its voice, and different characters spread over the approved voices', async () => {
  const { voiceFromPool } = await import('../src/lib/cloudVoice.ts');
  const pool = ['a', 'b', 'c'];
  assert.equal(voiceFromPool(pool, 7, 'x'), voiceFromPool(pool, 7, 'x'));
  const seen = new Set(Array.from({ length: 30 }, (_, i) => voiceFromPool(pool, i * 7919 + 3, 'x')));
  assert.deepEqual([...seen].sort(), ['a', 'b', 'c']);
  assert.equal(voiceFromPool([], 5, 'fallback'), 'fallback');
  assert.equal(voiceFromPool([], 5, null), null);
});

test('a character keeps its Natural voice and different characters spread over the Natural voices of the gender', () => {
  const en = [
    v('Microsoft Aria Online (Natural) - English (United States)', 'en-US'),
    v('Microsoft Jenny Online (Natural) - English (United States)', 'en-US'),
    v('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB'),
    v('Microsoft Guy Online (Natural) - English (United States)', 'en-US'),
    v('Microsoft Zira - English (United States)', 'en-US'),
  ];
  const pick = (seed: number) => rankVoices(en, 'en', 'f', null, seed).voice!.name;
  assert.equal(pick(5), pick(5), 'the same seed always gives the same voice');
  const seen = new Set(Array.from({ length: 30 }, (_, i) => pick(i * 7919 + 3)));
  assert.equal(seen.size, 3, 'all three female Natural voices are used, the basic Zira never is');
  assert.ok([...seen].every((n) => /Natural/.test(n)));
  assert.match(rankVoices(en, 'en', 'm', null, 11).voice!.name, /Guy/);
  assert.match(rankVoices(EDGE, 'pl', 'f', null, 99).voice!.name, /Zofia/, 'Polish has one Natural voice per gender, so the seed changes nothing');
  assert.match(rankVoices(en, 'en', 'f', 'Microsoft Zira - English (United States)', 2).voice!.name, /Zira/, 'the voice the user chose still wins');
});
