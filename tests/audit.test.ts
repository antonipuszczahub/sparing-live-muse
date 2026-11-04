import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanWording, countRepeats, ensureVerdict, markWording, MAX_VERDICT_CHARS, MAX_WORDING, measureDelivery, type AuditResult, type Wording } from '../shared/audit.ts';
import type { Turn } from '../shared/types.ts';

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

test('repeated words, repeated phrases and restarted words are counted', () => {
  assert.equal(countRepeats('I, I think we, we should go'), 2, 'a word twice in a row, punctuation between');
  assert.equal(countRepeats('I I I think so'), 2, 'three times is two repeats');
  assert.equal(countRepeats('We have two clinics, two clinics already pay us'), 1, 'a two-word phrase said twice');
  assert.equal(countRepeats('I w-w-want the p-p-price'), 2, 'a start repeated before the word');
  assert.equal(countRepeats('The wen- went well'), 1, 'a word that was cut off');
  assert.equal(countRepeats('Pani strona ładuje się, no, w-w-wiesz, siedem sekund', 'pl'), 1);
  assert.equal(countRepeats('Ale ale, ja ja nie wiem', 'pl'), 2);
});

test('words said twice on purpose and ordinary sentences are not repeats', () => {
  assert.equal(countRepeats('That is very very good, no no, bye bye'), 0);
  assert.equal(countRepeats('Nie, nie, to bardzo bardzo ważne', 'pl'), 0);
  assert.equal(countRepeats('Two clinics pay eight hundred a month each, and both renewed once.'), 0);
  assert.equal(countRepeats('We need a re-evaluation of the pre- and post-launch numbers.'), 1, 'only the cut-off "pre-" counts');
  assert.equal(countRepeats(''), 0);
});

test('the delivery metrics carry the repeats of the user lines only', () => {
  const turns: Turn[] = [
    { role: 'bot', text: 'No no no, tell me more.', at: 0 },
    { role: 'user', text: 'I, I mean, the the pilot is paid.', at: 4000 },
    { role: 'user', text: 'It is paid.', at: 9000 },
  ];
  assert.equal(measureDelivery(turns, 12000, false).repeats, 2);
});

const said: Turn[] = [
  { role: 'bot', text: 'Go on.', at: 0 },
  { role: 'user', text: 'Both clinics renewed, and a third sign next month. We was surprised.', at: 5000 },
  { role: 'bot', text: 'A third sign what?', at: 8000 },
  { role: 'user', text: 'The contract, i mean the pilot.', at: 11000 },
];
const w = (turn: number, said: string, better: string, note = 'x', kind: Wording['kind'] = 'grammar'): Wording => ({ turn, kind, said, better, note });

test('a language slip is kept only when its quote was really said by the user', () => {
  const kept = cleanWording([w(1, 'a third sign next month', 'a third signs next month'), w(1, 'We was surprised', 'We were surprised')], said);
  assert.deepEqual(kept.map((x) => x.better), ['a third signs next month', 'We were surprised']);
  assert.deepEqual(cleanWording([w(1, 'the third sign tomorrow', 'the third signs tomorrow')], said), [], 'an invented quote is dropped');
  assert.deepEqual(cleanWording([w(2, 'A third sign what', 'A third signs what')], said), [], 'a line of the character is not the user');
  assert.deepEqual(cleanWording([w(9, 'anything at all', 'something else')], said), [], 'a turn that does not exist');
});

test('a quote is matched without caring about case and punctuation, and an unchanged phrase is not a slip', () => {
  assert.equal(cleanWording([w(3, 'I MEAN the pilot', 'I mean, the pilot')], said).length, 0, 'same words, different punctuation: nothing to correct');
  assert.equal(cleanWording([w(3, 'i mean the pilot', 'I meant the pilot')], said).length, 1);
  assert.deepEqual(cleanWording([w(1, '??', 'x'), w(1, 'a third sign next month', '')], said), [], 'too short, or no correction');
});

test('the number of slips is capped, they come in the order of the call, and nothing when the model sent none', () => {
  const many = [
    w(3, 'i mean the pilot', 'I meant the pilot'),
    w(1, 'We was surprised', 'We were surprised'),
    w(1, 'a third sign next month', 'a third signs next month'),
    w(3, 'The contract', 'This contract'),
    w(1, 'Both clinics', 'The two clinics'),
    w(1, 'next month', 'in the coming month'),
    w(3, 'the pilot', 'the trial'),
  ];
  const out = cleanWording(many, said);
  assert.equal(out.length, MAX_WORDING);
  assert.deepEqual(out.map((x) => x.turn), [...out.map((x) => x.turn)].sort((a, b) => a - b));
  assert.deepEqual(cleanWording(undefined, said), []);
});

test('the kind of a slip is kept, and anything but "register" counts as grammar', () => {
  const [a, b] = cleanWording([w(1, 'a third sign next month', 'a third signs next month', 'x', 'register'), { ...w(1, 'We was surprised', 'We were surprised'), kind: 'nonsense' as Wording['kind'] }], said);
  assert.equal(a!.kind, 'register');
  assert.equal(b!.kind, 'grammar');
});

test('a slip is underlined where it was said: case and the punctuation around the quote do not matter', () => {
  const text = 'It was, like, forty billion. We are gonna grow.';
  const pieces = markWording(text, [w(0, '“Gonna grow.”', 'going to grow', 'x', 'register'), w(0, 'LIKE', 'roughly', 'x', 'register')]);
  assert.deepEqual(pieces.map((p) => p.text), ['It was, ', 'like', ', forty billion. We are ', 'gonna grow', '.']);
  assert.deepEqual(pieces.filter((p) => p.slip).map((p) => p.slip!.better), ['roughly', 'going to grow']);
  assert.equal(pieces.map((p) => p.text).join(''), text, 'the pieces put the line back together');
});

test('a slip that cannot be found as written, or overlaps another, is left unmarked; a regex-looking quote is safe', () => {
  assert.deepEqual(markWording('Nothing to mark here.', [w(0, 'absent words', 'x')]), [{ text: 'Nothing to mark here.' }]);
  const pieces = markWording('We are gonna grow fast.', [w(0, 'gonna grow', 'going to grow'), w(0, 'grow fast', 'expand quickly')]);
  assert.equal(pieces.filter((p) => p.slip).length, 1, 'the second one overlaps the first');
  assert.equal(markWording('Price (USD) is 3.000+', [w(0, '(USD) is 3.000+', 'x')]).filter((p) => p.slip).length, 1);
  assert.equal(markWording('Wiesz, po prostu spoko.', [w(0, 'spoko', 'w porządku', 'x', 'register')]).find((p) => p.slip)?.text, 'spoko');
});
