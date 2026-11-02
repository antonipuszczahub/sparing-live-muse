import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Turn } from '../shared/types.ts';
import { buildCaptions, captionSize } from '../src/lib/captions.ts';

const turns: Turn[] = [
  { role: 'bot', text: 'Hello, who is this?', at: 0 },
  { role: 'user', text: 'I am calling about your website.', at: 1000 },
  { role: 'bot', text: 'What about it?', at: 2000 },
  { role: 'user', text: 'It loads slowly.', at: 3000 },
];

test("the character's latest line is the large one and what you said after it is marked recent", () => {
  const lines = buildCaptions(turns, '', '');
  assert.deepEqual(
    lines.map((l) => [l.role, l.now, l.recent]),
    [
      ['bot', false, false],
      ['user', false, false],
      ['bot', true, false],
      ['user', false, true],
    ],
  );
});

test('a line keeps its key from the moment it is being spoken until it is a finished turn', () => {
  const speaking = buildCaptions(turns.slice(0, 2), 'What about', '');
  const done = buildCaptions(turns.slice(0, 3), '', '');
  assert.equal(speaking.at(-1)!.key, done.at(-1)!.key);
  assert.equal(speaking.at(-1)!.live, true);
  assert.equal(done.at(-1)!.live, false);
  const both = buildCaptions(turns.slice(0, 2), 'What about', 'It loads');
  assert.deepEqual(
    both.map((l) => l.live),
    [false, false, true, true],
  );
  assert.deepEqual(new Set(both.map((l) => l.key)).size, 4);
});

test('only the last few lines are kept', () => {
  assert.equal(buildCaptions(turns, '', '', 2).length, 2);
  assert.equal(buildCaptions(turns, '', '', 2)[1]!.text, 'It loads slowly.');
  assert.deepEqual(buildCaptions([], '', ''), []);
});

test('long monologues get a smaller type size', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');
  assert.equal(captionSize(words(10)), 'normal');
  assert.equal(captionSize(words(30)), 'long');
  assert.equal(captionSize(words(60)), 'huge');
});
