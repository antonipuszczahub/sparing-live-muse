import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AuditResult } from '../shared/audit.ts';
import { reviewAsText, type ReviewLabels } from '../src/lib/reviewText.ts';

const labels: ReviewLabels = {
  review: 'Call review',
  outcome: 'Partly there',
  skills: 'Skills',
  skillNames: { clarity: 'Clarity', listening: 'Listening', objections: 'Handling objections', specificity: 'Specificity', composure: 'Composure' },
  moments: 'Key moments',
  kinds: { strength: 'Strength', mistake: 'Mistake', 'turning-point': 'Turning point' },
  sayInstead: 'Say this instead',
  workNext: 'Work on next',
};

const result: AuditResult = {
  score: 58,
  outcome: 'partial',
  verdict: 'You had a paying customer and kept it hidden.',
  summary: 'Dana opened cold and warmed up after the pilot.',
  skills: { clarity: 7, listening: 4, objections: 5, specificity: 3, composure: 6 },
  moments: [
    { turn: 2, kind: 'mistake', what: 'You answered renewal with a market size.', why: 'Four fillers in one breath.', betterLine: 'Eight hundred a month per clinic.' },
    { turn: 1, kind: 'strength', what: 'You named the pilot.', why: 'Her attitude moved.', betterLine: '' },
  ],
  nextFocus: ['State the price before you are asked.', 'Answer in two sentences, then stop.'],
  weaknessTags: [],
};
const turns = [
  { role: 'bot' as const, text: 'Hi', at: 0 },
  { role: 'user' as const, text: 'We have a pilot', at: 31000 },
  { role: 'user' as const, text: 'The market is big', at: 101000 },
];

test('the review becomes Markdown with the score, verdict, skills, moments in order and the next steps', () => {
  const md = reviewAsText({ who: 'Dana Whitfield', durationMs: 192000, result, turns, labels });
  assert.match(md, /^# Call review: Dana Whitfield · 3:12\n\n\*\*58\/100\*\* · Partly there\n\n> You had a paying customer and kept it hidden\./);
  assert.match(md, /## Skills\n- Clarity: 7\/10\n- Listening: 4\/10/);
  assert.ok(md.indexOf('### Strength · 0:31') < md.indexOf('### Mistake · 1:41'), 'moments are in call order, with their time');
  assert.match(md, /Say this instead: “Eight hundred a month per clinic\.”/);
  assert.equal((md.match(/Say this instead/g) ?? []).length, 1, 'a moment without a better line has none');
  assert.match(md, /## Work on next\n1\. State the price before you are asked\.\n2\. Answer in two sentences, then stop\.\n$/);
});

test('a review with no moments and no next steps still reads cleanly', () => {
  const md = reviewAsText({ who: 'Dana', durationMs: 5000, result: { ...result, moments: [], nextFocus: [] }, turns, labels });
  assert.ok(!md.includes('## Key moments'));
  assert.ok(!md.includes('## Work on next'));
  assert.ok(md.endsWith('Composure: 6/10\n'));
});
