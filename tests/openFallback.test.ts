import assert from 'node:assert/strict';
import { test } from 'node:test';
import { characterTurn } from '../server/agents/persona.ts';
import { BudgetError } from '../server/meta/client.ts';
import type { SessionConfig } from '../shared/types.ts';
import { rollVariant } from '../shared/variation.ts';

const REPLY = 'THOUGHT: Cold call.\nMOOD: 3\nSAY: Slucham, o co chodzi?\nHANGUP: no';
const config = (provider?: 'open'): SessionConfig => ({ scenario: 'sales', level: 2, topic: 'x', persona: rollVariant('sales', 1).persona, variant: 1, provider });
const input = (provider?: 'open') => ({ config: config(provider), history: [], session: 's_test' });

type Run = Parameters<typeof characterTurn>[2];
/** A stand-in for the streaming call: what to do per provider, and a record of which providers were asked. */
function fake(byProvider: Record<string, (onDelta: (t: string) => void) => Promise<string>>) {
  const asked: string[] = [];
  const run = (async (o: { provider?: string }, onDelta: (t: string) => void) => {
    asked.push(o.provider ?? 'meta');
    return byProvider[o.provider ?? 'meta']!(onDelta);
  }) as unknown as Run;
  return { run, asked };
}

test('a normal Meta call is not touched by the fallback', async () => {
  const f = fake({ meta: async (d) => (d(REPLY), REPLY) });
  const r = await characterTurn(input(), () => {}, f.run);
  assert.equal(r.servedBy, 'meta');
  assert.deepEqual(f.asked, ['meta']);
});

test('an open-weights call is served by the open weights when the host answers', async () => {
  const f = fake({ open: async (d) => (d(REPLY), REPLY) });
  const r = await characterTurn(input('open'), () => {}, f.run);
  assert.equal(r.servedBy, 'open');
  assert.deepEqual(f.asked, ['open']);
});

test('a rate-limited or failing host falls back to Meta before anything was spoken', async () => {
  const f = fake({
    open: async () => {
      throw new Error('429 Rate limit exceeded');
    },
    meta: async (d) => (d(REPLY), REPLY),
  });
  const said: string[] = [];
  const r = await characterTurn(input('open'), (s) => said.push(s), f.run);
  assert.equal(r.servedBy, 'meta');
  assert.deepEqual(f.asked, ['open', 'meta']);
  assert.equal(said.join(''), 'Slucham, o co chodzi?');
});

test('an empty reply from the open host (the reasoning used the whole budget) also falls back', async () => {
  const f = fake({ open: async () => 'THOUGHT: \nMOOD: 3\nSAY: \nHANGUP: no', meta: async (d) => (d(REPLY), REPLY) });
  const r = await characterTurn(input('open'), () => {}, f.run);
  assert.equal(r.servedBy, 'meta');
});

test('once the character has started speaking a failure is not papered over', async () => {
  const f = fake({
    open: async (d) => {
      d('THOUGHT: x\nMOOD: 3\nSAY: Slucham, ');
      throw new Error('connection reset');
    },
    meta: async (d) => (d(REPLY), REPLY),
  });
  await assert.rejects(characterTurn(input('open'), () => {}, f.run), /connection reset/);
  assert.deepEqual(f.asked, ['open'], 'the spoken half sentence would repeat if the turn were asked again');
});

test('a spent budget and a hung-up user are not retried either', async () => {
  const budget = fake({ open: async () => Promise.reject(new BudgetError('daily')), meta: async () => REPLY });
  await assert.rejects(characterTurn(input('open'), () => {}, budget.run), BudgetError);
  assert.deepEqual(budget.asked, ['open']);

  const ac = new AbortController();
  const aborted = fake({ open: async () => (ac.abort(), Promise.reject(new Error('aborted'))), meta: async () => REPLY });
  await assert.rejects(characterTurn({ ...input('open'), signal: ac.signal }, () => {}, aborted.run), /aborted/);
  assert.deepEqual(aborted.asked, ['open']);
});
