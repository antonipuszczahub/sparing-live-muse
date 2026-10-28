// Researches a real company with live web search and prints the twin. Run: npm run try:twin -- basecamp.com
// A company researched in the last day comes from the cache (free, instant). Add --fresh to search again.
import { researchTwin } from '../server/agents/twinCache.ts';

const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const company = args.find((a) => !a.startsWith('--')) ?? 'basecamp.com';
const t0 = Date.now();
const { twin, cached } = await researchTwin(
  { company, scenario: 'sales', topic: 'A redesign of their website, 3,000 USD, two weeks', session: 'try-twin' },
  (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s  ${s.kind.padEnd(6)} ${s.text.slice(0, 110)}`),
  fresh ? { cache: null } : {},
);
console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)} s${cached ? ' (from cache)' : ''}\n`);
console.log(JSON.stringify(twin, null, 2));
