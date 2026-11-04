import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LedgerEntry } from '../server/meta/ledger.ts';
import { traceRows } from '../server/meta/trace.ts';

const e = (over: Partial<LedgerEntry>): LedgerEntry => ({ t: 1, kind: 'character-turn', model: 'muse-spark-1.3', session: 's', costUsd: 0.001, totalMs: 1000, ...over });

test('calls are grouped by role and model, in the order of a call', () => {
  const rows = traceRows([
    e({ kind: 'audit', model: 'muse-wonder-1.0', totalMs: 13000, costUsd: 0.04 }),
    e({ totalMs: 1000 }),
    e({ totalMs: 3000 }),
    e({ totalMs: 2000 }),
    e({ kind: 'portrait', model: 'muse-image-1.0', totalMs: 8000, costUsd: 0.01 }),
  ]);
  assert.deepEqual(
    rows.map((r) => r.kind),
    ['character-turn', 'portrait', 'audit'],
  );
  const turn = rows[0]!;
  assert.equal(turn.calls, 3);
  assert.equal(turn.medianMs, 2000);
  assert.ok(Math.abs(turn.costUsd - 0.003) < 1e-9);
  assert.equal(turn.served, 'Meta Model API');
  assert.equal(turn.open, false);
});

test('open-weights calls are their own row and say where they ran', () => {
  const rows = traceRows([e({ provider: 'open', model: 'meta-models/muse-spark-open-1026', costUsd: 0 }), e({})], 'Baseten');
  assert.equal(rows.length, 2);
  const open = rows.find((r) => r.open)!;
  assert.equal(open.served, 'Open weights · Baseten');
  assert.equal(open.costUsd, 0);
});

test('speech recognition has no latency, a third-party service is flagged, an empty session gives no rows', () => {
  const rows = traceRows([e({ kind: 'asr', model: 'muse-voice-transcribe-1.0', totalMs: 60000 }), e({ kind: 'tts', model: 'elevenlabs/x', provider: 'elevenlabs', costUsd: 0 })]);
  assert.equal(rows.find((r) => r.kind === 'asr')!.medianMs, null);
  assert.equal(rows.find((r) => r.kind === 'tts')!.served, 'Third-party service');
  assert.deepEqual(traceRows([]), []);
});
