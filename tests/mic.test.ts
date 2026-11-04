import assert from 'node:assert/strict';
import { test } from 'node:test';
import { looksVirtual, micConstraints, openMic } from '../src/lib/mic.ts';

const stream = { id: 'stream' } as unknown as MediaStream;
const fail = (name: string) => Object.assign(new DOMException('x', name));

test('without a chosen microphone the browser default is requested, with echo cancellation on', () => {
  const c = micConstraints(null);
  assert.equal('deviceId' in c, false);
  assert.equal(c.echoCancellation, true);
  assert.equal(c.channelCount, 1);
});

test('a chosen microphone is requested exactly', () => {
  assert.deepEqual(micConstraints('abc').deviceId, { exact: 'abc' });
});

test('a chosen microphone that is gone falls back to the default instead of failing the call', async () => {
  const asked: MediaStreamConstraints[] = [];
  const got = await openMic(async (c) => {
    asked.push(c);
    if (asked.length === 1) throw fail('OverconstrainedError');
    return stream;
  }, 'unplugged');
  assert.equal(got, stream);
  assert.equal(asked.length, 2);
  assert.deepEqual((asked[0]!.audio as MediaTrackConstraints).deviceId, { exact: 'unplugged' });
  assert.equal('deviceId' in (asked[1]!.audio as MediaTrackConstraints), false);
});

test('a refused permission is an error, not a reason to try the default', async () => {
  let calls = 0;
  await assert.rejects(
    openMic(async () => {
      calls++;
      throw fail('NotAllowedError');
    }, 'abc'),
    /x/,
  );
  assert.equal(calls, 1);
});

test('with no choice there is one request, and a missing device is reported', async () => {
  let calls = 0;
  await assert.rejects(
    openMic(async () => {
      calls++;
      throw fail('NotFoundError');
    }, null),
  );
  assert.equal(calls, 1);
});

test('names of virtual inputs are recognised, a headset is not', () => {
  for (const name of ['Default - Voicemeeter Out B1 (VB-Audio Voicemeeter VAIO)', 'CABLE Output (VB-Audio Virtual Cable)', 'Stereo Mix (Realtek(R) Audio)', 'Monitor of Built-in Audio']) {
    assert.equal(looksVirtual(name), true, name);
  }
  for (const name of ['Headset Microphone (Logitech G735)', 'Microphone (USB PnP Audio Device)', 'Default - Headset (WH-1000XM4 Hands-Free)', '']) {
    assert.equal(looksVirtual(name), false, name);
  }
});
