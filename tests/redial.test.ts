import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SessionConfig } from '../shared/types.ts';
import { rollVariant } from '../shared/variation.ts';
import { redial } from '../src/lib/redial.ts';

const base = (over: Partial<SessionConfig> = {}): SessionConfig => ({ scenario: 'pitch', level: 2, topic: 'An app', persona: rollVariant('pitch', 99).persona, variant: 99, ...over });

test('a redial keeps the same character and seed but gets a new session', () => {
  const c = base();
  const a = redial(c, [], 1_000_000);
  const b = redial(c, [], 2_000_000);
  assert.equal(a.config.variant, c.variant);
  assert.deepEqual(a.config.persona, c.persona);
  assert.notEqual(a.session, b.session);
  assert.match(a.session, /^s_[0-9a-z]+_[0-9a-z]+$/);
  assert.ok(a.session.length >= 4 && a.session.length <= 64, 'it fits what the server accepts');
});

test('a call that aimed at weak spots aims at the current ones, a call that did not still does not', () => {
  const aimed = redial(base({ focus: ['vague on price'] }), ['dodged renewal', 'no team pitch', 'garbled opening', 'fourth'], 1);
  assert.deepEqual(aimed.config.focus, ['dodged renewal', 'no team pitch', 'garbled opening']);
  assert.deepEqual(redial(base({ focus: ['vague on price'] }), [], 1).config.focus, ['vague on price'], 'nothing new to aim at: keep what it had');
  assert.equal(redial(base(), ['dodged renewal'], 1).config.focus, undefined);
});

test('the twin, the language and the provider survive a redial', () => {
  const c = base({ lang: 'pl', provider: 'open' });
  const r = redial(c, [], 1).config;
  assert.equal(r.lang, 'pl');
  assert.equal(r.provider, 'open');
});
