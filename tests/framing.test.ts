import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FramingTracker, type FaceBox } from '../shared/framing.ts';

const face = (cx = 0.5, size = 0.4): FaceBox => ({ x1: (cx - size / 2) * 640, x2: (cx + size / 2) * 640, y1: 100, y2: 100 + size * 480, w: 640, h: 480 });
const run = (samples: (FaceBox | null)[], step = 4000) => {
  const t = new FramingTracker();
  return samples.flatMap((s, i) => t.push(i * step, s ? [s] : []));
};

test('steady framing produces no events', () => {
  assert.deepEqual(run(Array.from({ length: 12 }, () => face())), []);
});

test('leaving the frame is reported once, with the time away', () => {
  const ev = run([face(), face(), face(), null, null, null, null, face()]);
  assert.deepEqual(ev.map((e) => e.text), ['Left the frame', 'Back in frame after 16 s']);
  assert.equal(ev[0]!.at, 12000);
});

test('a single dropped frame is not an event', () => {
  assert.deepEqual(run([face(), face(), face(), null, face(), face()]), []);
});

test('leaning back needs two samples in a row and is reported once', () => {
  const ev = run([face(), face(), face(), face(0.5, 0.2), face(0.5, 0.2), face(0.5, 0.2), face(0.5, 0.2)]);
  assert.deepEqual(ev.map((e) => e.text), ['Leaned back from the camera']);
});

test('drifting out of position is detected', () => {
  const ev = run([face(), face(), face(), face(0.85), face(0.85)]);
  assert.deepEqual(ev.map((e) => e.text), ['Drifted out of position in the frame']);
});

test('the largest face wins when two are visible', () => {
  const t = new FramingTracker();
  const events = [0, 1, 2, 3, 4].flatMap((i) => t.push(i * 4000, [face(0.5, 0.4), face(0.1, 0.1)]));
  assert.deepEqual(events, []);
});
