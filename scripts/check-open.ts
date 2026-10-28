// Probes the open-weights provider (Muse Spark Open on Baseten). Run: npm run check:open
import { stream, openWeightsConfigured } from '../server/meta/client.ts';
import { MODELS } from '../server/meta/models.ts';

if (!openWeightsConfigured()) {
  console.log('BASETEN_API_KEY is not set in .env, skipping.');
  process.exit(0);
}
const t0 = Date.now();
let first = 0;
const text = await stream(
  {
    model: MODELS.open,
    provider: 'open',
    kind: 'probe-open',
    maxTokens: 400,
    messages: [{ role: 'user', content: 'Reply in one short sentence: what is a good opening line for a sales call?' }],
  },
  () => (first ||= Date.now() - t0),
);
console.log(`model ${MODELS.open}\nfirst token ${first} ms, total ${Date.now() - t0} ms\n${text}`);
