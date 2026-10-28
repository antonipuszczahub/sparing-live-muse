import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SayStream, parseReply, formatReply } from '../server/agents/persona.ts';
import { cleanSpeech } from '../shared/speech.ts';

const RAW = 'THOUGHT: He dodged the price.\nMOOD: 2\nSAY: No price, no meeting. I have a bakery to run.\nHANGUP: no';

test('SayStream emits only the spoken text, however the chunks are cut', () => {
  for (const size of [1, 2, 3, 5, 8, 13, 100]) {
    const s = new SayStream();
    let out = '';
    for (let i = 0; i < RAW.length; i += size) out += s.push(RAW.slice(i, i + size));
    assert.equal(out, 'No price, no meeting. I have a bakery to run.', `chunk size ${size}`);
  }
});

test('SayStream never leaks a half-written HANGUP tag', () => {
  const s = new SayStream();
  let out = s.push('THOUGHT: x\nMOOD: 3\nSAY: Okay.\nHANG');
  assert.equal(out, 'Okay.');
  out += s.push('UP: yes');
  assert.equal(out, 'Okay.');
});

test('parseReply reads all four fields and clamps the mood', () => {
  const r = parseReply(RAW);
  assert.deepEqual(r, { thought: 'He dodged the price.', mood: 2, reply: 'No price, no meeting. I have a bakery to run.', hangup: false });
  assert.equal(parseReply('THOUGHT: a\nMOOD: 9\nSAY: bye\nHANGUP: yes').hangup, true);
  assert.equal(parseReply('THOUGHT: a\nMOOD: banana\nSAY: hi\nHANGUP: no').mood, 3);
});

test('parseReply survives a model that ignores the format', () => {
  assert.equal(parseReply('Just talking without tags.').reply, 'Just talking without tags.');
});

test('formatReply and parseReply round-trip', () => {
  const r = parseReply(formatReply({ thought: 't', mood: 4, text: 'Hello there.', hangup: true }));
  assert.deepEqual(r, { thought: 't', mood: 4, reply: 'Hello there.', hangup: true });
});

test('stage directions are removed from speech, even half-streamed ones', () => {
  assert.equal(cleanSpeech('*sigh* We started as a shop.'), 'We started as a shop.');
  assert.equal(cleanSpeech('Fine (pauses) go on.'), 'Fine go on.');
  assert.equal(cleanSpeech('Right. *clears thr').trim(), 'Right.');
});
