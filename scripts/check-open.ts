// Probes the open-weights provider (Muse Spark Open on Baseten, Fireworks, Modal or local Ollama). Run: npm run check:open
import { stream, openWeightsConfigured, openWeightsInfo } from '../server/meta/client.ts';

const info = openWeightsInfo();
if (!openWeightsConfigured() || !info) {
  console.log('No open-weights host is configured in .env (BASETEN_API_KEY, FIREWORKS_API_KEY + OPEN_MODEL, OPEN_HOST=ollama + OPEN_MODEL, or OPEN_BASE_URL + OPEN_API_KEY + OPEN_MODEL). Skipping.');
  process.exit(0);
}
const t0 = Date.now();
let first = 0;
const text = await stream(
  {
    model: info.model,
    provider: 'open',
    kind: 'probe-open',
    maxTokens: 400,
    messages: [{ role: 'user', content: 'Reply in one short sentence: what is a good opening line for a sales call?' }],
  },
  () => (first ||= Date.now() - t0),
);
console.log(`host ${info.label}\nmodel ${info.model}\nfirst token ${first} ms, total ${Date.now() - t0} ms\n${text}`);
