import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openByDefault, openHost, wantsOpenWeights } from '../server/meta/open.ts';

test('nothing configured means no open weights', () => {
  assert.equal(openHost({}), null);
  assert.equal(openHost({ MODEL_API_KEY: 'meta-only' }), null);
});

test('a Baseten key is enough: the hackathon model id is built in', () => {
  const h = openHost({ BASETEN_API_KEY: 'k' })!;
  assert.equal(h.id, 'baseten');
  assert.equal(h.label, 'Baseten');
  assert.equal(h.model, 'meta-models/muse-spark-open-1026');
  assert.equal(h.baseURL, 'https://inference.baseten.co/v1');
});

test('Fireworks needs the model id, because it differs per deployment', () => {
  assert.equal(openHost({ FIREWORKS_API_KEY: 'k' }), null);
  const h = openHost({ FIREWORKS_API_KEY: 'k', OPEN_MODEL: 'accounts/x/models/muse' })!;
  assert.equal(h.id, 'fireworks');
  assert.equal(h.model, 'accounts/x/models/muse');
});

test('local Ollama needs no key', () => {
  assert.equal(openHost({ OPEN_HOST: 'ollama' }), null, 'model is still required');
  const h = openHost({ OPEN_HOST: 'ollama', OPEN_MODEL: 'glimmer' })!;
  assert.equal(h.baseURL, 'http://localhost:11434/v1');
  assert.equal(h.apiKey, 'ollama');
});

test('a custom endpoint, for example vLLM on Modal, is labelled by its host', () => {
  const h = openHost({ OPEN_BASE_URL: 'https://me--open-serve.modal.run/v1', OPEN_API_KEY: 'k', OPEN_MODEL: 'muse' })!;
  assert.equal(h.id, 'custom');
  assert.equal(h.label, 'Modal');
  assert.equal(openHost({ OPEN_BASE_URL: 'https://me--open-serve.modal.run/v1', OPEN_MODEL: 'muse' }), null, 'key is required');
});

test('OPEN_HOST wins over key detection, and OPEN_LABEL renames it', () => {
  const h = openHost({ OPEN_HOST: 'fireworks', FIREWORKS_API_KEY: 'a', BASETEN_API_KEY: 'b', OPEN_MODEL: 'm', OPEN_LABEL: 'Fireworks (team)' })!;
  assert.equal(h.id, 'fireworks');
  assert.equal(h.label, 'Fireworks (team)');
});

test('Baseten runs Muse Spark Open at low reasoning by default, because its default (xhigh) is too slow to speak', () => {
  assert.equal(openHost({ BASETEN_API_KEY: 'k' })!.reasoningEffort, 'low');
});

test('the reasoning effort can be changed or left to the host, and other hosts get none unless told', () => {
  assert.equal(openHost({ BASETEN_API_KEY: 'k', OPEN_REASONING_EFFORT: 'medium' })!.reasoningEffort, 'medium');
  assert.equal('reasoningEffort' in openHost({ BASETEN_API_KEY: 'k', OPEN_REASONING_EFFORT: 'default' })!, false);
  assert.equal('reasoningEffort' in openHost({ FIREWORKS_API_KEY: 'k', OPEN_MODEL: 'm' })!, false);
  assert.equal(openHost({ FIREWORKS_API_KEY: 'k', OPEN_MODEL: 'm', OPEN_REASONING_EFFORT: 'low' })!.reasoningEffort, 'low');
});

test('open weights are the default when a host is configured, and the visitor can say otherwise', () => {
  const on = { BASETEN_API_KEY: 'k' };
  assert.equal(openByDefault(on), true);
  assert.equal(wantsOpenWeights(undefined, on), true);
  assert.equal(wantsOpenWeights('meta', on), false, 'the visitor unticked it');
  assert.equal(wantsOpenWeights('open', on), true);
  assert.equal(wantsOpenWeights(undefined, { ...on, OPEN_BY_DEFAULT: '0' }), false, 'a deployment can turn the default off');
  assert.equal(wantsOpenWeights('open', { ...on, OPEN_BY_DEFAULT: '0' }), true);
});

test('without a host nothing runs on open weights, whatever is asked', () => {
  assert.equal(openByDefault({}), false);
  assert.equal(wantsOpenWeights('open', {}), false);
  assert.equal(wantsOpenWeights(undefined, {}), false);
});
