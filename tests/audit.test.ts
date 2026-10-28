import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ensureVerdict, measureDelivery, type AuditResult } from '../shared/audit.ts';

test('delivery metrics are measured, not guessed', () => {
  const m = measureDelivery(
    [
      { role: 'bot', text: 'Speaking.', at: 0 },
      { role: 'user', text: 'Um, I basically help companies, you know, with websites.', at: 5000 },
      { role: 'bot', text: 'What exactly? —', at: 8000 },
      { role: 'user', text: 'Your site takes seven seconds to load.', at: 12000 },
    ],
    20000,
    false,
  );
  assert.equal(m.userTurns, 2);
  assert.equal(m.userWords, 16);
  assert.equal(m.fillerCount, 3);
  assert.equal(m.interruptions, 1);
  assert.equal(m.longestTurnWords, 9);
  assert.equal(m.durationSec, 20);
});

const result = (verdict: string, summary: string): AuditResult => ({
  score: 40,
  outcome: 'lost',
  verdict,
  summary,
  skills: { clarity: 1, listening: 1, objections: 1, specificity: 1, composure: 1 },
  moments: [],
  nextFocus: [],
  weaknessTags: [],
});

test('a verdict that is only the outcome word is replaced by the first sentence of the summary', () => {
  assert.equal(ensureVerdict(result('lost', 'Miałaś mocny start. Ale rozmowa się skończyła.')).verdict, 'Miałaś mocny start.');
  assert.equal(ensureVerdict(result('', 'Strong open, weak close. More follows.')).verdict, 'Strong open, weak close.');
  assert.equal(ensureVerdict(result('lost', 'No full stop here')).verdict, 'No full stop here');
});

test('a real verdict is left alone', () => {
  const r = result('Był konkret, który zadziałał, ale unik przy cenie zamknął rozmowę.', 'x');
  assert.equal(ensureVerdict(r), r);
});

test('Polish speech fillers are counted by the delivery metrics', () => {
  const m = measureDelivery([{ role: 'user', text: 'Yyy, no więc w sumie to jest ważne.', at: 0 }], 5000, false, 'pl');
  assert.equal(m.fillerCount, 3);
});
