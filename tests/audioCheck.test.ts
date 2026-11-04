import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyOutput, heardOwnVoice, heardVoice, percentile, rmsOf } from '../src/lib/audioCheck.ts';

const quiet = (n = 20) => Array.from({ length: n }, (_, i) => 0.002 + (i % 3) * 0.0005);
const loud = (n: number, level = 0.08) => Array.from({ length: n }, () => level);

test('output names are classified: headphones, speakers, virtual, unknown', () => {
  assert.equal(classifyOutput('Headphones (Realtek(R) Audio)'), 'headphones');
  assert.equal(classifyOutput('Headset Earphone (Jabra Evolve2 65)'), 'headphones');
  assert.equal(classifyOutput('Słuchawki (USB Audio)'), 'headphones');
  assert.equal(classifyOutput('WH-1000XM4 Hands-Free AG Audio'), 'headphones');
  assert.equal(classifyOutput('Speakers (Realtek(R) Audio)'), 'speakers');
  assert.equal(classifyOutput('Głośniki (Realtek)'), 'speakers');
  assert.equal(classifyOutput('DELL U2723QE (NVIDIA High Definition Audio)'), 'unknown');
  assert.equal(classifyOutput('Voicemeeter Input (VB-Audio Voicemeeter VAIO)'), 'virtual');
  assert.equal(classifyOutput(''), 'unknown');
});

test('the RMS of silence is zero, of a full-scale square wave one, and a percentile picks from the sorted values', () => {
  assert.equal(rmsOf([]), 0);
  assert.equal(rmsOf([0, 0, 0]), 0);
  assert.equal(rmsOf([1, -1, 1, -1]), 1);
  assert.equal(percentile([5, 1, 3, 2, 4], 0.5), 3);
  assert.equal(percentile([], 0.9), 0);
});

test('a voice is heard when the level stands clear of the room for several frames', () => {
  assert.equal(heardVoice(quiet(), [...quiet(10), ...loud(15)]), true);
  assert.equal(heardVoice(quiet(), quiet(40)), false, 'a silent microphone hears nobody');
  assert.equal(heardVoice(quiet(), [...quiet(30), 0.2, 0.2]), false, 'a click or two loud frames is not a voice');
});

test('a noisy room raises the bar, so room noise alone is not a voice', () => {
  const noisy = loud(20, 0.03);
  assert.equal(heardVoice(noisy, loud(40, 0.035)), false);
  assert.equal(heardVoice(noisy, loud(40, 0.12)), true);
});

test('the character is heard through the microphone when the sample stands clear of the room', () => {
  assert.equal(heardOwnVoice(quiet(), [...quiet(10), ...loud(30, 0.05)]), true, 'speakers leak into the microphone');
  assert.equal(heardOwnVoice(quiet(), quiet(60)), false, 'headphones: nothing leaks');
  assert.equal(heardOwnVoice(quiet(), [...quiet(50), 0.1, 0.1, 0.1]), false, 'a short bump is not echo');
});
