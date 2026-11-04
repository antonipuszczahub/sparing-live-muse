import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEFAULT_THEME, initialTheme, parseTheme, THEMES } from '../src/lib/theme.ts';

test('only the known looks are accepted, and the URL picks one', () => {
  assert.equal(parseTheme('maison'), 'maison');
  assert.equal(parseTheme('neon'), null);
  assert.equal(parseTheme(null), null);
  assert.equal(initialTheme('?theme=galerie'), 'galerie');
  assert.equal(initialTheme('?theme=nope'), DEFAULT_THEME, 'an unknown value falls back to the default');
  assert.equal(initialTheme(''), DEFAULT_THEME);
  assert.equal(DEFAULT_THEME, 'swiatlo');
  assert.equal(initialTheme('?theme=classic'), 'classic', 'the earlier light look is one link away');
});

test('every look except the default is defined in themes.css, with a name in both languages', () => {
  const css = readFileSync(new URL('../src/themes.css', import.meta.url), 'utf8');
  for (const id of THEMES.filter((x) => x !== 'classic')) assert.match(css, new RegExp(`:root\\[data-theme='${id}'\\]\\s*\\{`), id);
  const en = readFileSync(new URL('../src/i18n/en.ts', import.meta.url), 'utf8');
  const pl = readFileSync(new URL('../src/i18n/pl.ts', import.meta.url), 'utf8');
  for (const id of THEMES) {
    const key = `theme${id[0]!.toUpperCase()}${id.slice(1)}`;
    assert.match(en, new RegExp(`${key}:`), `en ${key}`);
    assert.match(pl, new RegExp(`${key}:`), `pl ${key}`);
  }
});

test('the corners and the light are variables, so a look can change them', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  for (const v of ['--round', '--r-pill', '--bg-grad', '--glow-a', '--glow-b', '--glow-c']) assert.match(css, new RegExp(`${v}:`), v);
});
