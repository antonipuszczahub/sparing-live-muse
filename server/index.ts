import express from 'express';
import { z } from 'zod';
import { audit } from './agents/auditor.ts';
import { characterTurn } from './agents/persona.ts';
import { BudgetError } from './meta/client.ts';
import { ledger } from './meta/ledger.ts';
import { SCENARIO_IDS } from '../shared/scenarios.ts';
import { newSeed, rollVariant } from '../shared/variation.ts';
import type { SessionConfig } from '../shared/types.ts';

const app = express();
app.use(express.json({ limit: '8mb' }));

const PersonaSchema = z.object({
  name: z.string(),
  role: z.string(),
  gender: z.enum(['m', 'f']),
  bio: z.string(),
});

const ConfigSchema = z.object({
  scenario: z.enum(SCENARIO_IDS as [string, ...string[]]),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  topic: z.string().max(400),
  persona: PersonaSchema,
  twin: z.any().optional(),
  variant: z.number().int().nonnegative(),
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
  screen: z.string().max(2000).optional(),
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, keyConfigured: Boolean(process.env.MODEL_API_KEY), budget: ledger.summary() });
});

/** Start a new call: roll today's variation and the character. */
app.post('/api/session', (req, res) => {
  const { scenario, level, topic } = z
    .object({ scenario: z.enum(SCENARIO_IDS as [string, ...string[]]), level: z.number().int().min(1).max(4), topic: z.string().max(400) })
    .parse(req.body);
  const variant = newSeed();
  const v = rollVariant(scenario as never, variant);
  const config: SessionConfig = { scenario: scenario as never, level: level as never, topic, persona: v.persona, variant };
  res.json({ session: `s_${variant.toString(36)}_${Date.now().toString(36)}`, config });
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

const AuditSchema = z.object({
  session: z.string().min(4).max(64),
  config: ConfigSchema,
  turns: TurnSchema.shape.history,
  durationMs: z.number().nonnegative(),
  hungUp: z.boolean(),
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

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => console.log(`Sparing Live server on http://localhost:${port}`));
