import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leafColor, mulberry32, parseZones, ZONE_FLOOR, zoneDim } from '../src/lib/vines.ts';

test('the same seed grows the same vines', () => {
  const a = mulberry32(11);
  const b = mulberry32(11);
  const c = mulberry32(12);
  const first = [a(), a(), a()];
  assert.deepEqual(first, [b(), b(), b()]);
  assert.notDeepEqual(first, [c(), c(), c()]);
  assert.ok(first.every((v) => v >= 0 && v < 1));
});

test('avoid zones are fractions of the screen; malformed ones are ignored', () => {
  const zones = parseZones('0.1,0,0.9,1;oops;0.2,0.2,0.4', 1000, 500);
  assert.deepEqual(zones, [{ cx: 500, cy: 250, hw: 400, hh: 250 }]);
  assert.deepEqual(parseZones(undefined, 100, 100), []);
  assert.deepEqual(parseZones('', 100, 100), []);
});

test('foliage fades out smoothly at the edge of a zone', () => {
  const zones = parseZones('0.1,0,0.9,1', 1000, 500);
  assert.equal(zoneDim(zones, 500, 250), ZONE_FLOOR);
  assert.equal(zoneDim(zones, 10, 250), 1);
  assert.equal(zoneDim([], 500, 250), 1);
  const ramp = [130, 100, 90, 70, 50].map((x) => zoneDim(zones, x, 250));
  assert.deepEqual([...ramp].sort((p, q) => p - q), ramp, 'dimming only gets lighter towards the outside');
  assert.ok(ramp[0]! >= ZONE_FLOOR && ramp[ramp.length - 1]! < 1);
});

test('leaf colour follows the mood and stays in range', () => {
  assert.deepEqual(leafColor(1), [9, 76, 47]);
  assert.deepEqual(leafColor(3), [88, 36, 38]);
  assert.deepEqual(leafColor(5), [79, 64, 48]);
  assert.deepEqual(leafColor(0), leafColor(1));
  assert.deepEqual(leafColor(9), leafColor(5));
  const [h] = leafColor(2.5);
  assert.ok(h > 38 && h < 88, 'halfway between cold and neutral');
});
