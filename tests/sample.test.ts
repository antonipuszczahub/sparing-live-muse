import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanWording, markWording } from '../shared/audit.ts';
import { ABOUT } from '../src/i18n/about.ts';
import { SAMPLE_TRACE, sampleConfig, sampleResult, sampleTurns } from '../src/sample/data.ts';

const LANGS = ['en', 'pl'] as const;

test('the sample call has the same shape in both languages and the lines alternate', () => {
  assert.equal(sampleTurns('en').length, sampleTurns('pl').length);
  for (const lang of LANGS) {
    const turns = sampleTurns(lang);
    turns.forEach((x, i) => assert.equal(x.role, i % 2 === 0 ? 'bot' : 'user', `${lang} line ${i}`));
    turns.forEach((x, i) => i > 0 && assert.ok(x.at > turns[i - 1]!.at, `${lang}: time goes forward at line ${i}`));
    for (const x of turns.filter((t) => t.role === 'bot')) {
      assert.ok(x.mood && x.mood >= 1 && x.mood <= 5, `${lang}: a bot line has a mood`);
      assert.ok((x.thought ?? '').length > 5, `${lang}: a bot line has a private thought`);
    }
  }
});

test('the sample review points at lines that exist and says why, in each language', () => {
  for (const lang of LANGS) {
    const turns = sampleTurns(lang);
    const result = sampleResult(lang);
    assert.ok(result.moments.length >= 2);
    for (const m of result.moments) {
      assert.ok(m.turn >= 0 && m.turn < turns.length, `${lang}: moment on turn ${m.turn}`);
      assert.ok(m.what.length > 5 && m.why.length > 5);
    }
    assert.ok(result.verdict.length > 10 && result.nextFocus.length === 3);
  }
  assert.notEqual(sampleResult('en').summary, sampleResult('pl').summary);
});

test('the sample review shows a grammar slip and a too-casual phrase, quoted from lines the user really said', () => {
  for (const lang of LANGS) {
    const turns = sampleTurns(lang);
    const wording = sampleResult(lang).wording ?? [];
    assert.deepEqual(wording.map((w) => w.kind), ['register', 'grammar'], lang);
    assert.deepEqual(cleanWording(wording, turns), wording, `${lang}: the quotes are in the lines`);
    for (const w of wording) assert.ok(markWording(turns[w.turn]!.text, [w]).some((p) => p.slip === w), `${lang}: "${w.said}" can be underlined where it was said`);
  }
});

test('the Polish sample is addressed in the register the config says', () => {
  const cfg = sampleConfig('pl');
  assert.equal(cfg.lang, 'pl');
  assert.deepEqual(cfg.user, { gender: 'm', formal: true });
  assert.match(sampleTurns('pl')[0]!.text, /\bPan/);
  assert.equal(sampleConfig('en').lang, 'en');
});

test('the sample trace names only Meta models and says which ran on open weights', () => {
  for (const row of SAMPLE_TRACE) assert.match(row.model, /muse|sam/i, row.model);
  assert.ok(SAMPLE_TRACE.some((r) => r.open));
});

test('the Demo panel offers the sample in both languages', () => {
  for (const lang of LANGS) {
    assert.ok(ABOUT[lang].sample.length > 5);
    assert.match(ABOUT[lang].sampleNote, lang === 'en' ? /no model/i : /żaden model/i);
  }
});
