// Researches a real company with live web search and prints the twin. Run: npm run try:twin -- basecamp.com
import { buildTwin } from '../server/agents/twin.ts';

const company = process.argv[2] ?? 'basecamp.com';
const t0 = Date.now();
const twin = await buildTwin(
  { company, scenario: 'sales', topic: 'A redesign of their website, 3,000 USD, two weeks', session: 'try-twin' },
  (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s  ${s.kind.padEnd(6)} ${s.text.slice(0, 110)}`),
);
console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);
console.log(JSON.stringify(twin, null, 2));
