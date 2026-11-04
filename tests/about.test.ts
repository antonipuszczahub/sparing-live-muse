import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ABOUT } from '../src/i18n/about.ts';

const strings = (a: (typeof ABOUT)['en']): string[] => [a.title, a.lead, a.watchTitle, a.builtTitle, a.built, a.nextTitle, a.nextNote, a.start, a.startNote, ...a.watch.flatMap((w) => [w.title, w.body]), ...a.next.flatMap((n) => [n.title, n.body])];

test('the Demo panel has the same shape in both languages and no empty text', () => {
  assert.equal(ABOUT.en.watch.length, ABOUT.pl.watch.length);
  assert.equal(ABOUT.en.next.length, ABOUT.pl.next.length);
  for (const lang of ['en', 'pl'] as const) for (const s of strings(ABOUT[lang])) assert.ok(s.trim().length > 3, `${lang}: "${s}"`);
});

test('the Polish text is not a copy of the English one', () => {
  const en = strings(ABOUT.en);
  const pl = strings(ABOUT.pl);
  pl.forEach((p, i) => assert.notEqual(p, en[i], `Polish text ${i} equals the English one`));
});

test('the panel never claims the plans exist, and it names only Meta models as what it runs on', () => {
  assert.match(ABOUT.en.nextNote, /built yet/i);
  assert.match(ABOUT.pl.nextNote, /jeszcze nie/i);
  for (const lang of ['en', 'pl'] as const) assert.doesNotMatch(ABOUT[lang].built, /elevenlabs|openai|gpt|gemini|claude/i);
});
