// Researches a real company with live web search and prints the twin. Run: npm run try:twin -- basecamp.com
// A company researched in the last day comes from the cache (free, instant). Add --fresh to search again,
// or --lang pl to get the twin written in Polish.
import { researchTwin } from '../server/agents/twinCache.ts';

const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const lang = args.includes('--lang') && args[args.indexOf('--lang') + 1] === 'pl' ? 'pl' : 'en';
const company = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--lang') ?? 'basecamp.com';
const topic = lang === 'pl' ? 'Przebudowa ich strony internetowej, 12 000 zł, dwa tygodnie' : 'A redesign of their website, 3,000 USD, two weeks';
const t0 = Date.now();
const { twin, cached } = await researchTwin(
  { company, scenario: 'sales', topic, session: 'try-twin', lang, gender: 'm' },
  (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s  ${s.kind.padEnd(6)} ${s.text.slice(0, 110)}`),
  fresh ? { cache: null } : {},
);
console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)} s${cached ? ' (from cache)' : ''}\n`);
console.log(JSON.stringify(twin, null, 2));
