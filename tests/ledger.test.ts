import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('the budget guard blocks new calls and survives a restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
  process.env.MANIFEST_PATH = join(dir, 'manifest.jsonl');
  process.env.DAILY_BUDGET_USD = '0.01';
  process.env.SESSION_BUDGET_USD = '0.005';

  const { ledger } = await import('../server/meta/ledger.ts');
  assert.equal(ledger.canSpend('a').ok, true);
  ledger.record({ kind: 'test', model: 'm', session: 'a', costUsd: 0.006 });
  assert.deepEqual(ledger.canSpend('a'), { ok: false, reason: 'session' });
  assert.equal(ledger.canSpend('b').ok, true, 'another visitor is unaffected');
  ledger.record({ kind: 'test', model: 'm', session: 'b', costUsd: 0.005 });
  assert.deepEqual(ledger.canSpend('c'), { ok: false, reason: 'daily' });

  // A fresh process reads today's spend from disk: restarting does not reset the limit.
  const lines = [{ t: Date.now(), kind: 'x', model: 'm', session: 'z', costUsd: 0.02 }].map((e) => JSON.stringify(e)).join('\n');
  writeFileSync(process.env.MANIFEST_PATH, lines + '\n');
  const fresh = await import('../server/meta/ledger.ts?restart');
  assert.deepEqual(fresh.ledger.canSpend('anyone'), { ok: false, reason: 'daily' });
});
