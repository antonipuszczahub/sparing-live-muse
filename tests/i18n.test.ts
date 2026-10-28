import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gendered, isLang, LANG_META, pluralPl } from '../shared/lang.ts';
import { moodLabel, translate } from '../src/i18n/index.ts';
import { en } from '../src/i18n/en.ts';
import { pl } from '../src/i18n/pl.ts';

test('both languages have exactly the same keys', () => {
  assert.deepEqual(Object.keys(pl).sort(), Object.keys(en).sort());
});

test('no Polish text is a copy of the English one', () => {
  for (const k of Object.keys(en) as (keyof typeof en)[]) {
    if (typeof en[k] === 'string') assert.notEqual(pl[k], en[k], `"${k}" is still English`);
  }
});

test('Polish plurals follow the three forms', () => {
  const f = (n: number) => pluralPl(n, 'tura', 'tury', 'tur');
  assert.deepEqual([0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 112, 122].map(f), ['tur', 'tura', 'tury', 'tury', 'tur', 'tur', 'tur', 'tur', 'tur', 'tury', 'tur', 'tur', 'tury']);
});

test('gender markers resolve to the right form and leave other text alone', () => {
  assert.equal(gendered('Jesteś zmęczon{y|a}, przeczyta{ł|ła} wszystko.', 'm'), 'Jesteś zmęczony, przeczytał wszystko.');
  assert.equal(gendered('Jesteś zmęczon{y|a}, przeczyta{ł|ła} wszystko.', 'f'), 'Jesteś zmęczona, przeczytała wszystko.');
  assert.equal(gendered('właściciel{|ka} małej firmy', 'f'), 'właścicielka małej firmy');
  assert.equal(gendered('{członek|członkini} komisji', 'f'), 'członkini komisji');
  assert.equal(gendered('plain text with { braces }', 'f'), 'plain text with { braces }');
});

test('sentences that depend on a count or a gender come out right', () => {
  assert.equal(translate('pl', 'reviewMeta', 'Daria', '2:10', 1, true, 'f'), 'Daria · 2:10 · 1 tura · rozłączyła się');
  assert.equal(translate('pl', 'reviewMeta', 'Marek', '2:10', 3, true, 'm'), 'Marek · 2:10 · 3 tury · rozłączył się');
  assert.equal(translate('pl', 'reviewMeta', 'Marek', '2:10', 7, false, 'm'), 'Marek · 2:10 · 7 tur');
  assert.equal(translate('en', 'reviewMeta', 'Greg', '2:10', 3, true, 'm'), 'Greg · 2:10 · 3 turns · they hung up');
  assert.deepEqual([1, 3, 7].map((n) => translate('pl', 'words', n)), ['1 słowo', '3 słowa', '7 słów']);
  assert.equal(translate('pl', 'hungUpBy', 'Daria', 'f'), 'Daria rozłączyła się');
  assert.equal(translate('pl', 'clipIntro1', 'f'), 'Przećwiczyłam tę rozmowę');
  assert.match(translate('pl', 'clipPost', 'Pitch dla inwestora', 'https://x.test', 'm'), /Przećwiczyłem rozmowę \(pitch dla inwestora\)/);
});

test('mood labels follow the language and the gender of the character', () => {
  assert.equal(moodLabel(1, 'en'), 'Hostile');
  assert.equal(moodLabel(1, 'pl', 'f'), 'Wrogo nastawiona');
  assert.equal(moodLabel(1, 'pl', 'm'), 'Wrogo nastawiony');
  assert.equal(moodLabel(4, 'pl', 'f'), 'Rozkręca się');
  assert.equal(moodLabel(5, 'pl', 'f'), 'Przekonana');
});

test('no sentence leaves a gender marker or the word "undefined" behind', () => {
  for (const lang of ['en', 'pl'] as const) {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const v = typeof en[key] === 'function' ? translate(lang, key, ...(['Daria', 'f', 5, true, 'm'] as never[])) : translate(lang, key);
      if (!key.startsWith('mood')) assert.doesNotMatch(v, /\{[^}]*\|[^}]*\}|undefined/, `${lang}.${key}: ${v}`);
    }
  }
});

test('language metadata names what the speech model and the browser expect', () => {
  assert.equal(LANG_META.pl.asr, 'Polish');
  assert.equal(LANG_META.pl.speech, 'pl-PL');
  assert.equal(LANG_META.en.asr, 'English');
  assert.ok(isLang('pl') && isLang('en') && !isLang('de') && !isLang(undefined));
});
