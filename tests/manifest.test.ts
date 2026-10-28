import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LedgerEntry } from '../server/meta/ledger.ts';
import { parseManifest, quantile, renderManifest } from '../server/meta/manifest.ts';

const T = Date.UTC(2026, 9, 28, 12);
const e = (o: Partial<LedgerEntry>): LedgerEntry => ({ t: T, kind: 'character-turn', model: 'muse-spark-1.3', costUsd: 0.001, ...o });

test('quantile picks from the sorted values', () => {
  assert.equal(quantile([], 0.5), undefined);
  assert.equal(quantile([900, 100, 500], 0.5), 500);
});

test('a half-written last line does not break parsing', () => {
  const rows = parseManifest(`${JSON.stringify(e({}))}\n{"t":17931`);
  assert.equal(rows.length, 1);
});

test('the manifest summarises models, roles and cost', () => {
  const md = renderManifest(
    [
      e({ session: 'a', promptTokens: 1000, completionTokens: 100, firstTokenMs: 800, totalMs: 1500 }),
      e({ session: 'a', promptTokens: 2000, completionTokens: 200, firstTokenMs: 1200, totalMs: 2500 }),
      e({ session: 'b', kind: 'audit', model: 'muse-wonder-1.0', costUsd: 0.034 }),
    ],
    { generatedAt: new Date(T) },
  );
  assert.match(md, /\*\*3\*\* model calls across \*\*2\*\* sessions/);
  assert.match(md, /\| `muse-spark-1\.3` \| Meta Model API \| 2 \| 3,000 \| 300 \|/);
  assert.match(md, /Post-call audit/);
  assert.match(md, /No open-weights calls have been recorded yet/);
});

test('open-weights calls get their own section and are not billed to Meta', () => {
  const md = renderManifest(
    [
      e({ session: 'a', costUsd: 0.5 }),
      e({ session: 'a', provider: 'open', model: 'meta-models/muse-spark-open-1026', costUsd: 0, promptTokens: 900, completionTokens: 90, firstTokenMs: 700 }),
    ],
    { generatedAt: new Date(T) },
  );
  assert.match(md, /open weights/);
  assert.match(md, /1 of 2 \(50%\)/);
  assert.match(md, /Cost billed by Meta: \*\*\$0\.500\*\*/);
  assert.doesNotMatch(md, /No open-weights calls have been recorded yet/);
});

test('an empty ledger says so', () => {
  assert.match(renderManifest([], { generatedAt: new Date(T) }), /ledger is empty/);
});
