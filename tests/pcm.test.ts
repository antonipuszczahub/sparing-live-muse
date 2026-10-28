import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimateSpoken, pcm16ToFloat32 } from '../src/lib/pcm.ts';

const le = (...v: number[]) => new Uint8Array(v.flatMap((n) => [n & 255, (n >> 8) & 255]));

test('16-bit little-endian samples become floats in [-1, 1)', () => {
  const { samples, rest } = pcm16ToFloat32(le(0, 16384, -16384, 32767, -32768));
  assert.deepEqual(Array.from(samples), [0, 0.5, -0.5, 32767 / 32768, -1]);
  assert.equal(rest.length, 0);
});

test('a chunk that ends in the middle of a sample carries its byte into the next one', () => {
  const all = le(1000, -2000, 3000);
  const a = pcm16ToFloat32(all.slice(0, 3));
  assert.equal(a.samples.length, 1);
  assert.equal(a.rest.length, 1);
  const b = pcm16ToFloat32(all.slice(3), a.rest);
  assert.deepEqual([...a.samples, ...b.samples].map((x) => Math.round(x * 32768)), [1000, -2000, 3000]);
  assert.equal(b.rest.length, 0);
});

test('the cut-off point is estimated from how much of the audio had played', () => {
  const s = 'Skąd Pani wzięła te siedem sekund, mierzyła to Pani u nas?';
  assert.equal(estimateSpoken(s, 0), '');
  assert.equal(estimateSpoken(s, 0.05), '');
  assert.equal(estimateSpoken(s, 0.5), 'Skąd Pani wzięła te siedem');
  assert.equal(estimateSpoken(s, 1), s);
  assert.equal(estimateSpoken(s, 3), s);
});
