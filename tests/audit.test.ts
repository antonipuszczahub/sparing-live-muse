import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ensureVerdict, MAX_VERDICT_CHARS, measureDelivery, type AuditResult } from '../shared/audit.ts';

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

test('a verdict that is a whole paragraph becomes a one-sentence headline and the rest joins the summary', () => {
  const paragraph =
    'You landed the one claim that mattered: two clinics already pay eight hundred a month. Then you never answered her question about recurring contracts, and she had to prompt you twice through a long silence before her mood dropped.';
  const r = ensureVerdict(result(paragraph, 'One strong proof line warmed her up.'));
  assert.equal(r.verdict, 'You landed the one claim that mattered: two clinics already pay eight hundred a month.');
  assert.ok(r.verdict.length <= MAX_VERDICT_CHARS);
  assert.equal(r.summary, 'Then you never answered her question about recurring contracts, and she had to prompt you twice through a long silence before her mood dropped. One strong proof line warmed her up.');
});

test('a single sentence that is too long for a headline is cut at a word and kept whole in the summary', () => {
  const long = 'You '.repeat(5) + 'opened with a very long and winding sentence that goes on and on about the market, the team, the pilot and the plan without ever stopping for breath or a number the investor could check.';
  const r = ensureVerdict(result(long, 'Short.'));
  assert.ok(r.verdict.length <= MAX_VERDICT_CHARS);
  assert.match(r.verdict, /…$/);
  assert.ok(!/\s…$/.test(r.verdict), 'no space before the ellipsis');
  assert.ok(r.summary.startsWith(long), 'the full text is not lost');
});

test('Polish speech fillers are counted by the delivery metrics', () => {
  const m = measureDelivery([{ role: 'user', text: 'Yyy, no więc w sumie to jest ważne.', at: 0 }], 5000, false, 'pl');
  assert.equal(m.fillerCount, 3);
});
