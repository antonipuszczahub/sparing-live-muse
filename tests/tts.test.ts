import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import { Allowance } from '../server/limits.ts';
import { defaultVoices, toCloudVoices, ttsConfig, ttsCostUsd, voicePool } from '../server/tts/elevenlabs.ts';
import { registerTts, thirdPartyVoiceEnv, voiceHealth } from '../server/tts/route.ts';

/** Ignores the approved names, so a test sees how the catalog itself ranks the voices. */
const NONE = { ELEVENLABS_VOICES_F: '', ELEVENLABS_VOICES_M: '' };

const RAW = [
  { voice_id: 'enm00000001', name: 'Brian', labels: { gender: 'male', accent: 'american' } },
  { voice_id: 'plf00000001', name: 'Ola', labels: { gender: 'female', accent: 'polish' }, verified_languages: [{ language: 'pl', locale: 'pl-PL' }] },
  { voice_id: 'plm00000001', name: 'Kuba', labels: { gender: 'male' }, verified_languages: [{ language: 'pl' }] },
  { voice_id: 'enf00000001', name: 'Sarah', labels: { gender: 'female' } },
  { name: 'No id' },
];

test('without a key there is no cloud voice, with one the price and model have defaults', () => {
  assert.equal(ttsConfig({}), null);
  assert.equal(ttsConfig({ ELEVENLABS_API_KEY: '  ' }), null);
  const cfg = ttsConfig({ ELEVENLABS_API_KEY: 'k' })!;
  assert.deepEqual([cfg.model, cfg.usdPer1k, cfg.baseUrl], ['eleven_v4_turbo', 0.04, 'https://api.elevenlabs.io']);
  assert.equal(ttsConfig({ ELEVENLABS_API_KEY: 'k', ELEVENLABS_MODEL: 'eleven_flash_v2_5', ELEVENLABS_BASE_URL: 'http://x/' })!.baseUrl, 'http://x');
  assert.equal(ttsCostUsd(2000, 0.04), 0.08);
});

test('voices are mapped, voices made for the language come first, and defaults follow gender', () => {
  const pl = toCloudVoices(RAW, 'pl');
  assert.deepEqual(pl.map((v) => v.name), ['Kuba', 'Ola', 'Sarah', 'Brian'], 'made for Polish, then no known accent, then another language accent');
  assert.deepEqual(pl.map((v) => v.native), [true, true, false, false]);
  assert.deepEqual(pl.map((v) => v.gender), ['m', 'f', 'f', 'm']);
  assert.deepEqual(defaultVoices(pl, 'pl', NONE), { m: 'plm00000001', f: 'plf00000001' });
  const en = toCloudVoices(RAW, 'en');
  assert.deepEqual(en.map((v) => v.name), ['Brian', 'Sarah', 'Kuba', 'Ola']);
  assert.deepEqual(defaultVoices(en, 'en', NONE), { m: 'enm00000001', f: 'enf00000001' }, 'a Polish voice is not the default for English');
  assert.equal(defaultVoices(pl, 'pl', { ELEVENLABS_VOICE_PL_F: 'custom12345' }).f, 'custom12345');
  assert.deepEqual(defaultVoices([], 'en', {}), { m: null, f: null });
});

test('the per-visitor allowance counts characters inside a window', () => {
  const a = new Allowance(1000);
  assert.equal(a.take('ip', 600, 1000, 0), true);
  assert.equal(a.take('ip', 500, 1000, 10), false, 'would pass the cap');
  assert.equal(a.take('other', 900, 1000, 10), true, 'another visitor has its own');
  assert.equal(a.take('ip', 500, 1000, 1500), true, 'the first request is out of the window');
});

test('health says whether the voice is on and how much of today is left', () => {
  assert.equal(voiceHealth({ charsToday: () => 0 }, {}), null);
  assert.deepEqual(voiceHealth({ charsToday: () => 50000 }, { ELEVENLABS_API_KEY: 'k', TTS_DAILY_CHARS: '60000' }), { provider: 'elevenlabs', model: 'eleven_v4_turbo', charsLeftToday: 10000 });
});

test('the third-party voice is off for a submission unless THIRD_PARTY_VOICE=on is set', () => {
  const withKey = { ELEVENLABS_API_KEY: 'k' };
  assert.equal(ttsConfig(thirdPartyVoiceEnv(withKey)), null, 'a key alone does not switch the voice on');
  assert.equal(voiceHealth({ charsToday: () => 0 }, thirdPartyVoiceEnv(withKey)), null);
  assert.equal(ttsConfig(thirdPartyVoiceEnv({ ...withKey, THIRD_PARTY_VOICE: 'yes' })), null, 'only the exact value counts');
  assert.ok(ttsConfig(thirdPartyVoiceEnv({ ...withKey, THIRD_PARTY_VOICE: 'on' })), 'explicitly on for local experiments');
});

function pcm(bytes = 4800) {
  return new Uint8Array(bytes).map((_, i) => i % 251);
}

async function boot(env: NodeJS.ProcessEnv, upstream: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const recorded: Record<string, unknown>[] = [];
  const ledger = {
    record: (e: Record<string, unknown>) => void recorded.push(e),
    charsToday: () => recorded.reduce((s, e) => s + Number(e.chars ?? 0), 0),
    charsBySession: (s: string) => recorded.filter((e) => e.session === s).reduce((n, e) => n + Number(e.chars ?? 0), 0),
  };
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : {} });
    return upstream(url, init);
  }) as unknown as typeof fetch;
  const app = express();
  app.use(express.json());
  registerTts(app, { ledger, env, fetchFn });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (body: unknown) => fetch(`${base}/api/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { base, post, recorded, calls, close: () => server.close() };
}

const GOOD = { session: 's_test', text: 'Dzień dobry, słucham.', lang: 'pl', voice: 'plf00000001' };

test('a sentence comes back as the PCM the voice produced and is written to the ledger', async () => {
  const s = await boot({ ELEVENLABS_API_KEY: 'k', ELEVENLABS_MODEL: 'm1' }, () => new Response(pcm(), { status: 200 }));
  try {
    const res = await s.post({ ...GOOD, previous: 'Halo.' });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-sample-rate'), '24000');
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()), pcm());
    assert.match(s.calls[0]!.url, /\/v1\/text-to-speech\/plf00000001\/stream\?output_format=pcm_24000$/);
    assert.deepEqual([s.calls[0]!.body.model_id, s.calls[0]!.body.language_code, s.calls[0]!.body.previous_text], ['m1', 'pl', 'Halo.']);
    assert.equal(s.recorded.length, 1);
    assert.deepEqual([s.recorded[0]!.chars, s.recorded[0]!.provider, s.recorded[0]!.costUsd], [GOOD.text.length, 'elevenlabs', 0]);
    assert.ok(Math.abs(Number(s.recorded[0]!.externalUsd) - (GOOD.text.length / 1000) * 0.04) < 1e-9);
  } finally {
    s.close();
  }
});

test('the routes refuse bad requests, a missing key and exhausted allowances', async () => {
  const off = await boot({}, () => new Response(pcm()));
  const on = await boot({ ELEVENLABS_API_KEY: 'k', TTS_CHARS_PER_SESSION: '30' }, () => new Response(pcm()));
  try {
    assert.equal((await off.post(GOOD)).status, 503);
    assert.equal((await fetch(`${off.base}/api/voices`)).status, 503);
    assert.equal((await on.post({ ...GOOD, voice: 'bad voice!' })).status, 400);
    assert.equal((await on.post({ ...GOOD, text: '' })).status, 400);
    assert.equal((await on.post(GOOD)).status, 200);
    const second = await on.post(GOOD);
    assert.equal(second.status, 429);
    assert.equal(((await second.json()) as { code: string }).code, 'limit');
  } finally {
    off.close();
    on.close();
  }
});

test('upstream failures are reported with a code the browser can act on', async () => {
  const codes: [number, string][] = [[401, 'auth'], [402, 'quota'], [500, 'unavailable']];
  for (const [status, code] of codes) {
    const s = await boot({ ELEVENLABS_API_KEY: 'k' }, () => new Response('nope', { status }));
    try {
      const res = await s.post(GOOD);
      assert.equal(((await res.json()) as { code: string }).code, code, String(status));
      assert.equal(s.recorded.length, 0, 'nothing is billed when nothing was spoken');
    } finally {
      s.close();
    }
  }
});

test('a model that refuses a forced language is retried without it, once', async () => {
  let n = 0;
  const upstream = () => (n++ === 0 ? new Response('language_code is not supported', { status: 400 }) : new Response(pcm()));
  const s = await boot({ ELEVENLABS_API_KEY: 'k', ELEVENLABS_MODEL: 'no-language-model' }, upstream);
  try {
    assert.equal((await s.post(GOOD)).status, 200);
    assert.equal(s.calls.length, 2);
    assert.equal(s.calls[0]!.body.language_code, 'pl');
    assert.equal('language_code' in s.calls[1]!.body, false);
    assert.equal((await s.post({ ...GOOD, session: 's_test2' })).status, 200);
    assert.equal('language_code' in s.calls[2]!.body, false, 'remembered for this model');
  } finally {
    s.close();
  }
});

test('optional fields a model refuses are dropped and remembered, one by one', async () => {
  const seen: string[][] = [];
  const upstream = (_u: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    seen.push(Object.keys(body));
    if ('previous_text' in body) return new Response('{"detail":"previous_text is not supported for this model"}', { status: 422 });
    if ('voice_settings' in body) return new Response('{"detail":"invalid value for stability"}', { status: 400 });
    return new Response(pcm());
  };
  const s = await boot({ ELEVENLABS_API_KEY: 'k', ELEVENLABS_MODEL: 'picky-model' }, upstream);
  try {
    assert.equal((await s.post({ ...GOOD, previous: 'Halo.' })).status, 200);
    assert.deepEqual(seen.at(-1), ['text', 'model_id', 'language_code']);
    const before = seen.length;
    assert.equal((await s.post({ ...GOOD, session: 's_test3', previous: 'Halo.' })).status, 200);
    assert.equal(seen.length - before, 1, 'the second sentence needed a single request');
  } finally {
    s.close();
  }
});

test('an error that names no optional field is not retried', async () => {
  let n = 0;
  const s = await boot({ ELEVENLABS_API_KEY: 'k', ELEVENLABS_MODEL: 'other-model' }, () => (n++, new Response('{"detail":"voice not found"}', { status: 400 })));
  try {
    assert.equal((await s.post(GOOD)).status, 502);
    assert.equal(n, 1);
  } finally {
    s.close();
  }
});

test('on the free plan library voices are locked and never the default; on a paid plan they are', () => {
  const raw = [
    { voice_id: 'lib00000001', name: 'Kinga', category: 'professional', labels: { gender: 'female' }, verified_languages: [{ language: 'pl' }] },
    { voice_id: 'pre00000001', name: 'Alice', category: 'premade', labels: { gender: 'female', accent: 'british' } },
  ];
  const free = toCloudVoices(raw, 'pl', 'free');
  assert.deepEqual(free.map((v) => [v.name, v.locked]), [['Kinga', true], ['Alice', false]]);
  assert.equal(defaultVoices(free, 'pl', NONE).f, 'pre00000001', 'the voice the plan cannot use is skipped');
  const paid = toCloudVoices(raw, 'pl', 'starter');
  assert.ok(paid.every((v) => !v.locked));
  assert.equal(defaultVoices(paid, 'pl', NONE).f, 'lib00000001', 'the native Polish voice wins once it can be used');
  assert.ok(toCloudVoices(raw, 'pl').every((v) => !v.locked), 'an unreadable plan locks nothing');
});

test('a library voice refused for the plan is reported as a plan problem, not as a used-up quota', async () => {
  const detail = '{"detail":{"type":"payment_required","code":"paid_plan_required","message":"Free users cannot use library voices via the API."}}';
  const s = await boot({ ELEVENLABS_API_KEY: 'k', ELEVENLABS_MODEL: 'plan-model' }, () => new Response(detail, { status: 402 }));
  try {
    const res = await s.post(GOOD);
    assert.equal(res.status, 402);
    assert.equal(((await res.json()) as { code: string }).code, 'plan');
  } finally {
    s.close();
  }
});

const VOICES = toCloudVoices(
  [
    { voice_id: 'sar00000001', name: 'Sarah - Mature, Reassuring', category: 'premade', labels: { gender: 'female' } },
    { voice_id: 'jes00000001', name: 'Jessica - Playful', category: 'premade', labels: { gender: 'female' } },
    { voice_id: 'lau00000001', name: 'Laura - Enthusiast', category: 'premade', labels: { gender: 'female' } },
    { voice_id: 'ali00000001', name: 'Alice - Clear', category: 'premade', labels: { gender: 'female' } },
    { voice_id: 'kin00000001', name: 'Kinga - Warm', category: 'professional', labels: { gender: 'female' } },
    { voice_id: 'bri00000001', name: 'Brian - Deep', category: 'premade', labels: { gender: 'male' } },
    { voice_id: 'eri00000001', name: 'Eric - Smooth', category: 'premade', labels: { gender: 'male' } },
    { voice_id: 'dan00000001', name: 'Daniel - Steady', category: 'premade', labels: { gender: 'male' } },
    { voice_id: 'geo00000001', name: 'George - Warm', category: 'premade', labels: { gender: 'male' } },
  ],
  'pl',
  'free',
);

test('the approved voices form the pool, in the order they were approved, and nothing else is in it', () => {
  assert.deepEqual(voicePool(VOICES, {}).f, ['sar00000001', 'jes00000001', 'lau00000001']);
  assert.deepEqual(voicePool(VOICES, {}).m, ['eri00000001', 'dan00000001', 'geo00000001'], 'approved, not merely available');
  assert.deepEqual(voicePool(VOICES, { ELEVENLABS_VOICES_M: 'Nobody' }).m, ['bri00000001'], 'with no approved voice available the first usable one stands in');
  assert.deepEqual(voicePool(VOICES, { ELEVENLABS_VOICES_F: 'Laura, Alice' }).f, ['lau00000001', 'ali00000001'], 'the list can be replaced');
  assert.deepEqual(voicePool(VOICES, { ELEVENLABS_VOICES_F: 'Kinga' }).f, voicePool(VOICES, NONE).f, 'a locked approved voice is skipped, the rest of the catalog stands in');
});

test('the default is the first approved voice unless one is forced', () => {
  assert.equal(defaultVoices(VOICES, 'pl', {}).f, 'sar00000001');
  assert.equal(defaultVoices(VOICES, 'pl', { ELEVENLABS_VOICE_PL_F: 'forced123456' }).f, 'forced123456');
});
