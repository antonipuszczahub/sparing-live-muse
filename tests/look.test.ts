import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('Światło is the only look: set on the page, defined once, no switcher left', () => {
  assert.match(read('index.html'), /<html[^>]*data-theme="swiatlo"/);
  const css = read('src/themes.css');
  assert.match(css, /:root\[data-theme='swiatlo'\]\s*\{/);
  assert.deepEqual([...new Set([...css.matchAll(/data-theme='([a-z]+)'/g)].map((m) => m[1]))], ['swiatlo']);
  assert.doesNotMatch(read('src/main.tsx'), /theme\.ts|applyTheme/);
});

test('every token a style sheet reads with a fallback is defined by the look, so no surface stays white on the dark page', () => {
  const css = read('src/themes.css');
  const dir = new URL('../src/', import.meta.url);
  const sheets = [...readdirSync(new URL('screens/', dir)).map((f) => `src/screens/${f}`), ...readdirSync(new URL('components/', dir)).map((f) => `src/components/${f}`)].filter((f) => f.endsWith('.module.css'));
  const defined = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]));
  // tokens that are not colours of the look (viewport helpers, per-element values set by the components)
  const elsewhere = new Set(['--vw', '--vh', '--dvh', '--vmax', '--vmin', '--zoom', '--round', '--glass-r', '--mc', '--c', '--a', '--w', '--ph', '--px', '--py', '--mood', '--h']);
  const missing = new Set<string>();
  for (const f of sheets) {
    for (const m of read(f).matchAll(/var\((--[a-z0-9-]+),\s*(?:rgba?\(|#|linear-gradient|0 )/g)) {
      const name = m[1]!;
      if (!defined.has(name) && !elsewhere.has(name)) missing.add(`${name} (${f})`);
    }
  }
  assert.deepEqual([...missing], []);
});

test('large screens are zoomed, and no style sheet uses a raw viewport unit that the zoom would scale twice', () => {
  const index = read('src/index.css');
  for (const v of ['--zoom', '--vw', '--vh', '--dvh', '--vmax']) assert.match(index, new RegExp(`${v}:`), v);
  assert.match(index, /zoom: var\(--zoom\)/);
  assert.match(index, /@media \(min-width: 2400px\) and \(min-height: 1250px\)/);
  const dir = new URL('../src/', import.meta.url);
  const sheets = [...readdirSync(new URL('screens/', dir)).map((f) => `src/screens/${f}`), ...readdirSync(new URL('components/', dir)).map((f) => `src/components/${f}`), 'src/themes.css'].filter((f) => f.endsWith('.css'));
  for (const f of sheets) {
    const withoutVars = read(f).replace(/var\(--(?:vw|vh|dvh|vmax|vmin), 1(?:vw|vh|dvh|vmax|vmin)\)/g, '');
    const raw = withoutVars.match(/(?<![\w-])-?(?:\d+\.?\d*|\.\d+)(?:vw|vh|dvh|svh|lvh|vmax|vmin)\b/g) ?? [];
    assert.deepEqual(raw, [], `${f} has a raw viewport unit: write it as calc(N * var(--vw, 1vw))`);
  }
});
