import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSystemPrompt } from '../server/agents/persona.ts';
import { LEVELS_PL, SCENARIOS_PL } from '../shared/scenarios.pl.ts';
import { LEVELS, SCENARIO_IDS, SCENARIOS } from '../shared/scenarios.ts';
import type { Lang, Level, SessionConfig } from '../shared/types.ts';
import { rollVariant } from '../shared/variation.ts';

const MARKER = /\{[^{}]*\|[^{}]*\}/;

function config(lang: Lang, scenario: SessionConfig['scenario'] = 'sales', seed = 77): SessionConfig {
  const v = rollVariant(scenario, seed, lang);
  return { scenario, level: 2, topic: 'Strona internetowa, 12 000 zł', persona: v.persona, variant: seed, ...(lang === 'pl' ? { lang, user: { gender: 'm' as const, formal: true } } : {}) };
}

test('no habit or hidden agenda makes the character echo the user or blurt out a need in its first lines', () => {
  for (const lang of ['en', 'pl'] as const) {
    for (const id of SCENARIO_IDS) {
      for (let seed = 1; seed <= 80; seed++) {
        const v = rollVariant(id, seed * 97, lang);
        assert.doesNotMatch(v.tic, /repeats the last|powtarzasz dwa ostatnie|echo/i, `${lang}/${id}: ${v.tic}`);
        assert.doesNotMatch(v.agenda, /\bearly\b|wcześnie rzucasz/i, `${lang}/${id}: ${v.agenda}`);
      }
    }
  }
});

test('the character prompt teaches how people really sound on a call, in both languages', () => {
  const en = buildSystemPrompt(config('en'));
  assert.match(en, /# How real people sound on a call/);
  assert.match(en, /Never repeat the user's words, or the end of their sentence/);
  assert.match(en, /do not reveal your agenda or your mood/);
  assert.match(en, /never as if a stranger were calling you/);
  assert.match(en, /only now and then, never in every turn/);
  const pl = buildSystemPrompt(config('pl'));
  assert.match(pl, /# Jak naprawdę brzmią ludzie przez telefon/);
  assert.match(pl, /Nigdy nie powtarzaj słów rozmówcy ani końcówki jego zdania/);
  assert.match(pl, /nie zwracaj się samym imieniem w wołaczu/);
  assert.match(pl, /nigdy tak, jakby dzwonił do Ciebie obcy/);
  assert.doesNotMatch(pl, MARKER, 'every gender marker is resolved');
  assert.doesNotMatch(pl, /wypowiedziałaby\b|byś wypowiedzia/, 'the earlier broken "byś wypowiedziałaby" is gone');
});

test('the character is told to stay logical: no re-asking, a serious admission is answered and ends the meeting, formality is mirrored', () => {
  const en = buildSystemPrompt(config('en'));
  assert.match(en, /# Staying logical/);
  assert.match(en, /Never ask for something they have just told you/);
  assert.match(en, /passing off someone else's work or an AI's as their own, being drunk/);
  assert.match(en, /At Realistic and harder levels such an admission ends the meeting/);
  const pl = buildSystemPrompt(config('pl'));
  assert.match(pl, /# Trzymaj się logiki/);
  assert.match(pl, /Nie pytaj o to, co dopiero co usłysza(?:łeś|łaś)/);
  assert.match(pl, /bycie pod wpływem alkoholu/);
  assert.match(pl, /per Pan\/Pani/);
  assert.doesNotMatch(pl, MARKER);
});

test('every scenario has its own spoken-sounding example lines in both languages, and the prompt carries that scenario\'s', () => {
  for (const id of SCENARIO_IDS) {
    assert.ok(SCENARIOS[id].sounds.length >= 4 && SCENARIOS_PL[id].sounds.length >= 4, id);
    const en = buildSystemPrompt(config('en', id));
    const pl = buildSystemPrompt(config('pl', id));
    for (const line of SCENARIOS[id].sounds) assert.ok(en.includes(`"${line}"`), `en ${id}: ${line}`);
    for (const line of SCENARIOS_PL[id].sounds) assert.ok(pl.includes(`„${line}”`), `pl ${id}: ${line}`);
    assert.doesNotMatch(pl, MARKER, id);
  }
  assert.ok(!buildSystemPrompt(config('en', 'pitch')).includes(SCENARIOS.sales.sounds[2]!), 'a pitch does not get the cold-call lines');
});

test('the character is told only the general subject, so it cannot quote the user\'s numbers back before they are said', () => {
  assert.match(buildSystemPrompt(config('en')), /do not mention any number, name or detail from the topic until the user says it/);
  assert.match(buildSystemPrompt(config('pl')), /nie wspominaj o żadnej liczbie, nazwie ani szczególe z tego tematu/);
});

test('a cold call is answered like a phone, a booked meeting is not opened as if a stranger called', () => {
  assert.match(SCENARIOS.sales.opening, /Hello\?/);
  assert.match(SCENARIOS_PL.sales.opening, /Halo\?/);
  for (const id of ['defense', 'salary', 'pitch'] as const) {
    assert.match(SCENARIOS[id].opening, /scheduled/, `en ${id}`);
    assert.match(SCENARIOS_PL[id].opening, /umówion/, `pl ${id}`);
  }
});

test('the spoken turns get shorter as the difficulty goes up, and equally so in both languages', () => {
  const limits = ([1, 2, 3, 4] as Level[]).map((l) => LEVELS[l].maxWords);
  assert.deepEqual(limits, [...limits].sort((a, b) => b - a), 'a harder level never talks more');
  assert.ok(limits[0]! <= 40 && limits[3]! <= 18, 'real phone turns are short: no monologues');
  for (const l of [1, 2, 3, 4] as Level[]) assert.equal(LEVELS_PL[l].maxWords, LEVELS[l].maxWords);
});

test('the character answers a remark about itself or the call first, does not re-ask, and keeps its thought honest, in both languages', () => {
  const en = buildSystemPrompt(config('en'));
  assert.match(en, /# When the user talks about you or about the call/);
  assert.match(en, /chatbot/);
  assert.match(en, /never answer it by asking your opening question again/);
  assert.match(en, /THOUGHT[\s\S]*never mentions acting, playing a role/);
  const pl = buildSystemPrompt(config('pl'));
  assert.match(pl, /# Gdy rozmówca mówi o Tobie albo o rozmowie/);
  assert.match(pl, /chatbotem/);
  assert.match(pl, /nigdy nie odpowiadaj na to ponownym zadaniem swojego pierwszego pytania/);
  assert.match(pl, /MYŚL \(THOUGHT\)[\s\S]*Nigdy nie wspomina o graniu/);
  assert.doesNotMatch(pl, MARKER, 'every gender marker is resolved');
});
