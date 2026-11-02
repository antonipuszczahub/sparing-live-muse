import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Mood } from '../shared/types.ts';
import { layoutMoodVine, momentLetters, type MoodNode } from '../src/lib/moodVine.ts';

const nodes = (moods: Mood[]): MoodNode[] => moods.map((mood, i) => ({ turn: i * 2, mood, at: i * 30_000 }));

test('there is nothing to draw before the character has spoken twice', () => {
  assert.equal(layoutMoodVine(nodes([3]), [], false), null);
  assert.equal(layoutMoodVine([], [], true), null);
});

test('on a wide screen the vine grows left to right and a better mood sits higher', () => {
  const layout = layoutMoodVine(nodes([3, 2, 4]), [], false)!;
  assert.equal(layout.vertical, false);
  const [a, b, c] = layout.nodes;
  assert.ok(a!.x < b!.x && b!.x < c!.x);
  assert.ok(c!.y < a!.y && a!.y < b!.y, 'warming up is above neutral, cold is below');
  // one curve per gap, plus the two that make the curl at the tip
  assert.equal(layout.path.match(/C/g)!.length, 2 + 2);
  assert.ok(layout.path.startsWith(`M${a!.x},${a!.y}`));
  assert.equal(layout.guides.length, 5);
});

test('on a phone it grows top to bottom and a better mood sits further right', () => {
  const layout = layoutMoodVine(nodes([3, 2, 4]), [], true)!;
  assert.equal(layout.vertical, true);
  assert.equal(layout.width, 350);
  const [a, b, c] = layout.nodes;
  assert.ok(a!.y < b!.y && b!.y < c!.y);
  assert.ok(b!.x < a!.x && a!.x < c!.x);
  assert.ok(layout.height > c!.y);
});

test('a flag sits between the two turns that surround its moment', () => {
  // the character speaks at turns 0, 2, 4; the user's turns 1 and 3 sit between them
  const layout = layoutMoodVine(nodes([3, 2, 3]), [{ turn: 3, kind: 'mistake' }, { turn: 1, kind: 'strength' }], false)!;
  const [n0, n1, n2] = layout.nodes;
  assert.deepEqual(
    layout.flags.map((f) => [f.letter, f.kind, f.turn]),
    [
      ['A', 'strength', 1],
      ['B', 'mistake', 3],
    ],
  );
  assert.equal(layout.flags[0]!.x, (n0!.x + n1!.x) / 2);
  assert.equal(layout.flags[1]!.x, (n1!.x + n2!.x) / 2);
});

test('a moment before the first or after the last turn hangs off the end of the vine', () => {
  const layout = layoutMoodVine(nodes([3, 3]), [{ turn: -1, kind: 'strength' }, { turn: 9, kind: 'mistake' }], false)!;
  const [first, last] = layout.nodes;
  assert.ok(layout.flags[0]!.x < first!.x);
  assert.ok(layout.flags[1]!.x > last!.x);
});

test('moments are lettered in transcript order, at most eight', () => {
  const letters = momentLetters([{ turn: 7 }, { turn: 2 }, { turn: 5 }]);
  assert.deepEqual([...letters], [
    [2, 'A'],
    [5, 'B'],
    [7, 'C'],
  ]);
  assert.equal(momentLetters(Array.from({ length: 12 }, (_, i) => ({ turn: i }))).size, 8);
});

test('long calls label only some of the points in time', () => {
  const layout = layoutMoodVine(nodes(Array.from({ length: 20 }, () => 3 as Mood)), [], false)!;
  const shown = layout.nodes.filter((n) => n.showTime).length;
  assert.ok(shown >= 5 && shown <= 10);
});
