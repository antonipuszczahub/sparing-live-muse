import type { Express } from 'express';
import { z } from 'zod';
import { Allowance } from '../limits.ts';
import { defaultVoices, listVoices, speak, ttsConfig, ttsCostUsd, TtsError, voicePool } from './elevenlabs.ts';

/** What the routes need from the budget ledger; the real ledger satisfies it, tests pass a small fake. */
export interface TtsLedger {
  record(e: { kind: string; model: string; provider: string; session: string; costUsd: number; chars: number; externalUsd: number; firstTokenMs: number }): unknown;
  charsToday(provider: string): number;
  charsBySession(session: string, provider: string): number;
}

const Body = z.object({
  session: z.string().min(4).max(64),
  text: z.string().min(1).max(500),
  lang: z.enum(['en', 'pl']).optional(),
  voice: z.string().regex(/^[A-Za-z0-9]{8,40}$/),
  previous: z.string().max(500).optional(),
});

/** Caps in characters. A 5-minute call is about 2,000, so the defaults allow a few calls per visitor per hour. */
export function ttsLimits(env: NodeJS.ProcessEnv = process.env) {
  return {
    session: Number(env.TTS_CHARS_PER_SESSION) || 8000,
    ip: Number(env.TTS_CHARS_PER_IP_HOUR) || 20000,
    day: Number(env.TTS_DAILY_CHARS) || 150000,
  };
}

/**
 * The hackathon allows only Meta models at runtime, and ElevenLabs is not one, so the cloud voice stays off (the
 * browser's own voice speaks) unless THIRD_PARTY_VOICE=on is set. That switch is for local experiments only and
 * must not be set on the host that serves the submission.
 */
export function thirdPartyVoiceEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return env.THIRD_PARTY_VOICE === 'on' ? env : { ...env, ELEVENLABS_API_KEY: '' };
}

/** For /api/health: is the voice on, and how much of today's allowance is left. */
export function voiceHealth(ledger: Pick<TtsLedger, 'charsToday'>, env: NodeJS.ProcessEnv = process.env) {
  const cfg = ttsConfig(env);
  if (!cfg) return null;
  return { provider: 'elevenlabs', model: cfg.model, charsLeftToday: Math.max(0, ttsLimits(env).day - ledger.charsToday('elevenlabs')) };
}

export function registerTts(app: Express, deps: { ledger: TtsLedger; env?: NodeJS.ProcessEnv; fetchFn?: typeof fetch }) {
  const { ledger, fetchFn = fetch } = deps;
  const env = deps.env ?? process.env;
  const perVisitor = new Allowance();

  app.get('/api/voices', async (req, res) => {
    const cfg = ttsConfig(env);
    if (!cfg) return void res.status(503).json({ error: 'Voice is not configured', code: 'off' });
    const lang = req.query.lang === 'pl' ? 'pl' : 'en';
    try {
      const voices = await listVoices(cfg, lang, fetchFn);
      res.json({ model: cfg.model, voices, defaults: defaultVoices(voices, lang, env), pool: voicePool(voices, env) });
    } catch (e) {
      const err = e instanceof TtsError ? e : new TtsError('unavailable', 'Could not list voices');
      res.status(err.status).json({ error: err.message, code: err.code });
    }
  });

  /** One sentence of speech: raw 16-bit PCM at 24 kHz, streamed as ElevenLabs produces it. */
  app.post('/api/tts', async (req, res) => {
    const cfg = ttsConfig(env);
    if (!cfg) return void res.status(503).json({ error: 'Voice is not configured', code: 'off' });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
    const { session, text, lang = 'en', voice, previous } = parsed.data;
    const chars = text.length;
    const cap = ttsLimits(env);
    const over =
      ledger.charsBySession(session, 'elevenlabs') + chars > cap.session ||
      ledger.charsToday('elevenlabs') + chars > cap.day ||
      !perVisitor.take(req.ip ?? 'unknown', chars, cap.ip);
    if (over) return void res.status(429).json({ error: 'Voice allowance reached', code: 'limit' });

    const ac = new AbortController();
    res.on('close', () => ac.abort());
    const t0 = Date.now();
    try {
      const upstream = await speak(cfg, { voiceId: voice, text, lang, previous, signal: ac.signal }, fetchFn);
      // The characters are billed when the request is accepted, whether or not the browser plays them all.
      ledger.record({ kind: 'tts', model: `elevenlabs/${cfg.model}`, provider: 'elevenlabs', session, costUsd: 0, chars, externalUsd: ttsCostUsd(chars, cfg.usdPer1k), firstTokenMs: Date.now() - t0 });
      res.status(200).set({ 'Content-Type': 'application/octet-stream', 'X-Sample-Rate': '24000', 'Cache-Control': 'no-store' });
      if (upstream.body) for await (const chunk of upstream.body as unknown as AsyncIterable<Uint8Array>) if (!ac.signal.aborted) res.write(chunk);
      res.end();
    } catch (e) {
      if (res.headersSent) return void res.end();
      const err = e instanceof TtsError ? e : new TtsError('unavailable', 'Voice failed');
      if (!ac.signal.aborted) res.status(err.status).json({ error: err.message, code: err.code });
    }
  });
}
