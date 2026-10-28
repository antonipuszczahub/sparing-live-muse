// Probes the Meta Model API once the key is in .env: what really works, and how fast.
// Run: npm run check:meta
import { complete, stream } from '../server/meta/client.ts';
import { MODELS } from '../server/meta/models.ts';
import { ledger } from '../server/meta/ledger.ts';

async function probe(name: string, fn: () => Promise<string>) {
  const t0 = Date.now();
  try {
    const out = await fn();
    console.log(`PASS ${name} (${Date.now() - t0} ms): ${out.replace(/\s+/g, ' ').slice(0, 110)}`);
  } catch (e) {
    const err = e as { status?: number; message?: string };
    console.log(`FAIL ${name}: ${err.status ?? ''} ${(err.message ?? String(e)).slice(0, 240)}`);
  }
}

const model = MODELS.sparkDev;
const ask = [{ role: 'user' as const, content: 'Reply with exactly: ok' }];

await probe('chat completion', () => complete({ model, messages: ask, kind: 'probe', maxTokens: 300 }));
await probe('chat + reasoning_effort=minimal', () => complete({ model, messages: ask, kind: 'probe', maxTokens: 300, effort: 'minimal' }));
await probe('streaming (first token latency)', async () => {
  let first = 0;
  const t0 = Date.now();
  const text = await stream({ model, messages: ask, kind: 'probe', maxTokens: 300 }, () => (first ||= Date.now() - t0));
  return `${text} [first token ${first} ms]`;
});
await probe('json schema output', () =>
  complete({
    model,
    kind: 'probe',
    maxTokens: 400,
    messages: [{ role: 'user', content: 'Give a mood and a one-line reply of a grumpy customer.' }],
    schema: {
      name: 'reply',
      schema: {
        type: 'object',
        properties: { mood: { type: 'integer' }, line: { type: 'string' } },
        required: ['mood', 'line'],
        additionalProperties: false,
      },
    },
  }),
);
await probe('wonder', () => complete({ model: MODELS.wonder, messages: ask, kind: 'probe', maxTokens: 300, effort: 'minimal' }));

const s = ledger.summary();
console.log(`\nSpent on this probe: $${s.spentToday.toFixed(4)}`);
