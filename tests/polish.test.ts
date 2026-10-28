import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSystemPrompt } from '../server/agents/persona.ts';
import { researchTwin, TwinCache, twinKey } from '../server/agents/twinCache.ts';
import { measureDelivery } from '../shared/audit.ts';
import { FramingTracker, type FaceBox } from '../shared/framing.ts';
import { beginNote, simNote } from '../shared/notes.ts';
import { LEVELS_PL, SCENARIOS_PL } from '../shared/scenarios.pl.ts';
import { LEVELS, SCENARIO_IDS, SCENARIOS } from '../shared/scenarios.ts';
import { cleanSpeech } from '../shared/speech.ts';
import type { Level, SessionConfig } from '../shared/types.ts';
import { rollVariant } from '../shared/variation.ts';
import { novelWords } from '../src/lib/text.ts';

const MARKER = /\{[^{}]*\|[^{}]*\}/;

function config(over: Partial<SessionConfig> = {}, seed = 4242): SessionConfig {
  const v = rollVariant('sales', seed, 'pl');
  return { scenario: 'sales', level: 2, topic: 'Strona internetowa', persona: v.persona, variant: seed, lang: 'pl', ...over };
}

test('every scenario and level exists in Polish with the same shape as in English', () => {
  for (const id of SCENARIO_IDS) {
    assert.deepEqual(Object.keys(SCENARIOS_PL[id]).sort(), Object.keys(SCENARIOS[id]).sort());
    for (const v of Object.values(SCENARIOS_PL[id])) assert.ok(String(v).length > 0 || id === 'defense');
  }
  for (const l of [1, 2, 3, 4] as Level[]) {
    assert.equal(LEVELS_PL[l].maxWords, LEVELS[l].maxWords, 'difficulty limits are the same in both languages');
    assert.equal(LEVELS_PL[l].rules.length, LEVELS[l].rules.length);
  }
});

test('a Polish character is fully resolved for its gender and keeps its seed', () => {
  for (const id of SCENARIO_IDS) {
    for (let seed = 1; seed <= 60; seed++) {
      const v = rollVariant(id, seed * 131, 'pl');
      for (const text of [v.persona.role, v.persona.bio, v.circumstance, v.agenda, v.mood, v.tic]) assert.doesNotMatch(text, MARKER, `${id}/${seed}: ${text}`);
      assert.deepEqual(v, rollVariant(id, seed * 131, 'pl'));
    }
  }
});

test('the Polish prompt states the gender of both people and the form of address', () => {
  const formalWoman = buildSystemPrompt(config({ user: { gender: 'f', formal: true } }));
  assert.match(formalWoman, /Rozmówca jest kobietą/);
  assert.match(formalWoman, /per „Pani”/);
  assert.match(formalWoman, /powiedziałaś/);

  const informalMan = buildSystemPrompt(config({ user: { gender: 'm', formal: false } }));
  assert.match(informalMan, /Rozmówca jest mężczyzną/);
  assert.match(informalMan, /na „ty”/);

  const unknown = buildSystemPrompt(config());
  assert.match(unknown, /Nie znasz płci rozmówcy/);

  for (const p of [formalWoman, informalMan, unknown]) {
    assert.doesNotMatch(p, MARKER);
    assert.match(p, /THOUGHT: .*\nMOOD: .*\nSAY: .*\nHANGUP: /s, 'the parser tags are intact');
  }
  const woman = config({ persona: { ...config().persona, gender: 'f' } });
  const man = config({ persona: { ...config().persona, gender: 'm' } });
  assert.match(buildSystemPrompt(woman), /Jesteś kobietą.*zrobiłam/s);
  assert.match(buildSystemPrompt(man), /Jesteś mężczyzną.*zrobiłem/s);
});

test('the Polish prompt carries the difficulty limit, the twin and the screen', () => {
  const twin = { company: 'Acme', url: '', buyerRole: 'Dyrektor produktu', buyerBio: 'Odpowiada za rozwój.', summary: 'Robią oprogramowanie.', customers: 'Firmy', pains: ['cena'], objections: ['za drogo'], vocabulary: ['projekty'], sources: [] };
  const p = buildSystemPrompt(config({ level: 4, twin, focus: ['niejasno o cenie'] }), { screen: 'Slajd 3: 94%' });
  assert.match(p, /najwyżej 26 słów/);
  assert.match(p, /Acme/);
  assert.match(p, /za drogo/);
  assert.match(p, /niejasno o cenie/);
  assert.match(p, /Slajd 3: 94%/);
});

test('the English prompt is untouched by the Polish work', () => {
  const p = buildSystemPrompt({ ...config(), lang: undefined, persona: rollVariant('sales', 4242).persona });
  assert.match(p, /Spoken English, short/);
  assert.doesNotMatch(p, /Jesteś/);
});

test('simulator notes and the opening are in the language of the call', () => {
  assert.equal(simNote('silent', 'pl'), '[rozmówca milczy od dłuższej chwili]');
  assert.equal(simNote('silent'), '[the user has been silent for a while]');
  assert.match(beginNote(SCENARIOS_PL.sales.opening, 'pl'), /Zacznij teraz\.\]$/);
  assert.match(beginNote(SCENARIOS.sales.opening), /Begin now\.\]$/);
});

test('Polish filler words are counted, and only as whole words', () => {
  const turn = (text: string) => [{ role: 'user' as const, text, at: 0 }];
  const count = (text: string) => measureDelivery(turn(text), 1000, false, 'pl').fillerCount;
  assert.equal(count('Yyy, no więc w sumie jakby to jest ważne.'), 4);
  assert.equal(count('Jakbyśmy mieli więcej czasu, właściwie wszystko byłoby proste.'), 1, '"jakbyśmy" is not a filler, "właściwie" is');
  assert.equal(count('Zmierzyłam to wczoraj, wynik to siedem sekund.'), 0);
});

test('echo detection keeps Polish letters inside words', () => {
  const bot = 'Skąd Pani wzięła te siedem sekund, mierzyła Pani moją stronę?';
  assert.equal(novelWords('mierzyła Pani moją stronę', bot, 'pl').length, 0);
  assert.ok(novelWords('Zmierzyłam to dziś rano na telefonie', bot, 'pl').length >= 2);
  assert.deepEqual(novelWords('łączy', 'inne słowa', 'pl'), ['łączy'], 'ł must not cut a word in two');
});

test('stage directions in Polish are removed from speech', () => {
  assert.equal(cleanSpeech('*westchnienie* Słucham, o co chodzi?'), 'Słucham, o co chodzi?');
  assert.equal(cleanSpeech('Dobrze (pauza) mów dalej.'), 'Dobrze mów dalej.');
});

test('a Polish research does not reuse an English one, and English keys did not change', () => {
  const input = { company: 'basecamp.com', scenario: 'sales' as const, topic: 'A website redesign' };
  assert.notEqual(twinKey({ ...input, lang: 'pl' }), twinKey(input));
  assert.notEqual(twinKey({ ...input, lang: 'pl', gender: 'f' }), twinKey({ ...input, lang: 'pl', gender: 'm' }), 'a woman profile is not served to a man');
  assert.equal(twinKey({ ...input, gender: 'f' }), twinKey({ ...input, gender: 'm' }), 'English text does not depend on gender');
  const before = createHash('sha1').update('sales|basecamp.com|a website redesign').digest('hex').slice(0, 16);
  assert.equal(twinKey(input), before, 'existing English cache entries stay valid');
  assert.equal(twinKey({ ...input, lang: 'en' }), before);
});

test('a replayed research says so in Polish', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'twins-pl-'));
  try {
    const cache = new TwinCache(dir, 3_600_000);
    const twin = { company: 'Acme', url: '', buyerRole: 'x', buyerBio: 'x', summary: 'x', customers: 'x', pains: ['x'], objections: ['x'], vocabulary: [], sources: [] };
    const input = { company: 'acme.pl', scenario: 'sales' as const, topic: 'Strona', session: 's_test', lang: 'pl' as const };
    await researchTwin(input, () => {}, { cache, build: async () => twin, paceMs: 0 });
    const seen: string[] = [];
    const second = await researchTwin(input, (s) => seen.push(s.text), { cache, build: async () => assert.fail('researched again'), paceMs: 0 });
    assert.equal(second.cached, true);
    assert.match(seen[0]!, /Korzystam z badania wykonanego 1 min temu/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('camera framing facts are phrased without the user gender', () => {
  const face = (cx = 0.5, size = 0.4): FaceBox => ({ x1: (cx - size / 2) * 640, x2: (cx + size / 2) * 640, y1: 100, y2: 100 + size * 480, w: 640, h: 480 });
  const t = new FramingTracker('pl');
  const out = [face(), face(), face(), null, null, null, null, face()].flatMap((s, i) => t.push(i * 4000, s ? [s] : []));
  assert.deepEqual(out.map((e) => e.text), ['Wyjście z kadru', 'Powrót do kadru po 16 s']);
});
