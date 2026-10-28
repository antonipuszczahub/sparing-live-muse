import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { z } from 'zod';
import { attachAsr } from './asr.ts';
import { audit } from './agents/auditor.ts';
import { look } from './agents/eye.ts';
import { findFaces } from './agents/sam.ts';
import { characterTurn } from './agents/persona.ts';
import { drawPortraits, type Portraits } from './agents/portrait.ts';
import { researchTwin, twinCache, twinKey } from './agents/twinCache.ts';
import { BudgetError, openWeightsInfo } from './meta/client.ts';
import { openByDefault, wantsOpenWeights } from './meta/open.ts';
import { rateLimit } from './limits.ts';
import { ledger } from './meta/ledger.ts';
import { registerTts, thirdPartyVoiceEnv, voiceHealth } from './tts/route.ts';
import { SCENARIO_IDS } from '../shared/scenarios.ts';
import { newSeed, rollVariant } from '../shared/variation.ts';
import type { SessionConfig } from '../shared/types.ts';

// Keys written by the ElevenLabs CLI live in .env.local; load them too when the file exists (they do not override .env).
try {
  process.loadEnvFile('.env.local');
} catch {
  /* no such file */
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '8mb' }));

const PersonaSchema = z.object({
  name: z.string(),
  role: z.string(),
  gender: z.enum(['m', 'f']),
  bio: z.string(),
});

const LangSchema = z.enum(['en', 'pl']);
const UserSchema = z.object({ gender: z.enum(['m', 'f']), formal: z.boolean() });

const ConfigSchema = z.object({
  scenario: z.enum(SCENARIO_IDS as [string, ...string[]]),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  topic: z.string().max(400),
  persona: PersonaSchema,
  twin: z.any().optional(),
  variant: z.number().int().nonnegative(),
  focus: z.array(z.string().max(80)).max(3).optional(),
  provider: z.enum(['meta', 'open']).optional(),
  lang: LangSchema.optional(),
  user: UserSchema.optional(),
});

const TurnSchema = z.object({
  session: z.string().min(4).max(64),
  config: ConfigSchema,
  history: z.array(
    z.object({
      role: z.enum(['user', 'bot']),
      text: z.string(),
      thought: z.string().optional(),
      mood: z.number().optional(),
      at: z.number(),
    }),
  ),
  screen: z.string().max(4000).optional(),
});

app.get('/api/health', (_req, res) => {
  const open = openWeightsInfo();
  res.json({
    ok: true,
    keyConfigured: Boolean(process.env.MODEL_API_KEY),
    openWeights: Boolean(open),
    openHost: open?.label,
    openModel: open?.model,
    openDefault: openByDefault(),
    voice: voiceHealth(ledger, thirdPartyVoiceEnv()),
    budget: ledger.summary(),
  });
});

/** Start a new call: roll today's variation and the character. */
app.post('/api/session', rateLimit('session', Number(process.env.SESSIONS_PER_IP_HOUR) || 6), (req, res) => {
  const { scenario, level, topic, focus, provider, lang, user } = z
    .object({
      scenario: z.enum(SCENARIO_IDS as [string, ...string[]]),
      level: z.number().int().min(1).max(4),
      topic: z.string().max(400),
      focus: z.array(z.string().max(80)).max(3).optional(),
      provider: z.enum(['meta', 'open']).optional(),
      lang: LangSchema.optional(),
      user: UserSchema.optional(),
    })
    .parse(req.body);
  const variant = newSeed();
  const v = rollVariant(scenario as never, variant, lang);
  const config: SessionConfig = {
    scenario: scenario as never,
    level: level as never,
    topic,
    persona: v.persona,
    variant,
    focus,
    provider: wantsOpenWeights(provider) ? 'open' : undefined,
    // English is the default and stays out of the config, so old and new clients agree.
    lang: lang === 'pl' ? 'pl' : undefined,
    user: lang === 'pl' ? user : undefined,
  };
  const session = `s_${variant.toString(36)}_${Date.now().toString(36)}`;
  // Start drawing the face now: by the time the call connects (after twin research, if any) it is ready.
  if (ledger.canSpend(session).ok && process.env.MODEL_API_KEY) {
    const job = drawPortraits({ persona: v.persona, scenario: scenario as never, mood: '', session, lang });
    portraitCache.set(session, job);
    job.catch(() => portraitCache.delete(session));
  }
  res.json({ session, config });
});

/**
 * One character turn as Server-Sent Events:
 *   event: say    data: {"delta": "..."}          spoken text as it streams
 *   event: final  data: BotReply                  thought, mood, full reply, hangup
 *   event: error  data: {"message", "budget"?}
 */
app.post('/api/turn', async (req, res) => {
  const parsed = TurnSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const ac = new AbortController();
  res.on('close', () => ac.abort());

  try {
    const { session, config, history, screen } = parsed.data;
    const final = await characterTurn(
      {
        config: config as SessionConfig,
        history: history as never,
        session,
        screen,
        signal: ac.signal,
      },
      (delta) => send('say', { delta }),
    );
    send('final', final);
  } catch (e) {
    if (e instanceof BudgetError) send('error', { message: e.message, budget: e.reason });
    else if (!ac.signal.aborted) send('error', { message: e instanceof Error ? e.message : 'Unknown error' });
  } finally {
    res.end();
  }
});

/**
 * Digital twin research as Server-Sent Events:
 *   event: step  data: {kind: search|open|note, text}   live progress of the research agent
 *   event: twin  data: TwinProfile
 *   event: error data: {message, budget?}
 */
const twinLimit = rateLimit('twin', Number(process.env.TWINS_PER_IP_HOUR) || 5);
app.post('/api/twin', async (req, res) => {
  const parsed = z
    .object({
      session: z.string().min(4).max(64),
      company: z.string().min(2).max(200),
      scenario: z.enum(SCENARIO_IDS as [string, ...string[]]),
      topic: z.string().max(400),
      lang: LangSchema.optional(),
      gender: z.enum(['m', 'f']).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const wanted = { ...parsed.data, scenario: parsed.data.scenario as never };
  // A cached twin costs nothing, so only a fresh research counts against the visitor's limit.
  if (!twinCache.has(twinKey(wanted))) {
    let allowed = false;
    twinLimit(req, res, () => {
      allowed = true;
    });
    if (!allowed) return;
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const ac = new AbortController();
  res.on('close', () => ac.abort());
  try {
    const { twin } = await researchTwin({ ...wanted, signal: ac.signal }, (step) => send('step', step));
    send('twin', twin);
  } catch (e) {
    if (e instanceof BudgetError) send('error', { message: e.message, budget: e.reason });
    else if (!ac.signal.aborted) send('error', { message: e instanceof Error ? e.message : 'Research failed' });
  } finally {
    res.end();
  }
});

/** The eye agent: notes on the user's shared screen, from one JPEG frame. */
app.post('/api/eye', async (req, res) => {
  const parsed = z
    .object({
      session: z.string().min(4).max(64),
      scenario: z.enum(SCENARIO_IDS as [string, ...string[]]),
      topic: z.string().max(400),
      image: z.string().startsWith('data:image/').max(6_000_000),
      lang: LangSchema.optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const notes = await look({ ...parsed.data, scenario: parsed.data.scenario as never });
    res.json({ notes });
  } catch (e) {
    if (e instanceof BudgetError) res.status(429).json({ error: e.message, budget: e.reason });
    else res.status(502).json({ error: e instanceof Error ? e.message : 'Eye agent failed' });
  }
});

const portraitCache = new Map<string, Promise<Portraits>>();

/** Muse Image draws the counterpart in three moods. Cached per session; the client loads it in the background. */
app.post('/api/portraits', async (req, res) => {
  const parsed = z
    .object({ session: z.string().min(4).max(64), scenario: z.enum(SCENARIO_IDS as [string, ...string[]]), persona: PersonaSchema, lang: LangSchema.optional() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { session, scenario, persona, lang } = parsed.data;
  let job = portraitCache.get(session);
  if (!job) {
    job = drawPortraits({ persona, scenario: scenario as never, mood: '', session, lang });
    portraitCache.set(session, job);
    job.catch(() => portraitCache.delete(session));
  }
  try {
    res.json(await job);
  } catch (e) {
    if (e instanceof BudgetError) res.status(429).json({ error: e.message, budget: e.reason });
    else res.status(502).json({ error: e instanceof Error ? e.message : 'Portrait failed' });
  }
});

/** Camera framing: SAM 3.1 finds the face in one JPEG frame. Only boxes leave the server. */
app.post('/api/camera', async (req, res) => {
  const parsed = z
    .object({ session: z.string().min(4).max(64), image: z.string().startsWith('data:image/').max(2_000_000) })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    res.json({ faces: await findFaces(parsed.data.image, parsed.data.session) });
  } catch (e) {
    if (e instanceof BudgetError) res.status(429).json({ error: e.message, budget: e.reason });
    else res.status(502).json({ error: e instanceof Error ? e.message : 'Camera analysis failed' });
  }
});

const AuditSchema = z.object({
  session: z.string().min(4).max(64),
  config: ConfigSchema,
  turns: TurnSchema.shape.history,
  durationMs: z.number().nonnegative(),
  hungUp: z.boolean(),
  camera: z.array(z.object({ at: z.number().nonnegative(), text: z.string().max(80) })).max(40).optional(),
});

/** Post-call audit by Muse Wonder. Takes tens of seconds, so the client shows progress. */
app.post('/api/audit', async (req, res) => {
  const parsed = AuditSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const { config, turns, ...rest } = parsed.data;
    const result = await audit({ config: config as SessionConfig, turns: turns as never, ...rest });
    res.json(result);
  } catch (e) {
    if (e instanceof BudgetError) res.status(429).json({ error: e.message, budget: e.reason });
    else res.status(502).json({ error: e instanceof Error ? e.message : 'Audit failed' });
  }
});

// The character's voice is the browser's own (an OS feature, not a model call). ElevenLabs is available only with
// THIRD_PARTY_VOICE=on, because the hackathon allows only Meta models at runtime.
registerTts(app, { ledger, env: thirdPartyVoiceEnv() });

// Production: the same server serves the built front end.
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|ws).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
}

const port = Number(process.env.PORT) || 8787;
const server = app.listen(port, () => console.log(`Sparing Live server on http://localhost:${port}`));
attachAsr(server);
