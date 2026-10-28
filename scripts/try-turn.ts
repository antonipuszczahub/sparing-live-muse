// Plays a short scripted call against the live character agent and prints latency per turn.
// Run: npm run try:turn
import { characterTurn } from '../server/agents/persona.ts';
import { ledger } from '../server/meta/ledger.ts';
import { rollVariant } from '../shared/variation.ts';
import type { SessionConfig, Turn } from '../shared/types.ts';

const variant = Number(process.argv[2]) || 12345;
const level = (Number(process.argv[3]) || 3) as 1 | 2 | 3 | 4;
const v = rollVariant('sales', variant);
const config: SessionConfig = {
  scenario: 'sales',
  level,
  topic: 'A redesign of their website, 3,000 USD, two weeks',
  persona: v.persona,
  variant,
};

const script = [
  'Hi, this is Alex from Brightside Web. I help small companies get more customers from their website.',
  'Sure. Your current site loads in about seven seconds on a phone, and most visitors leave before it opens.',
  'We rebuild it in two weeks for three thousand dollars, and you only pay when you approve the result.',
];

const history: Turn[] = [];
const t0 = Date.now();
console.log(`${v.persona.name} (${v.persona.role}), level ${level}. Today: ${v.circumstance}\n`);

async function bot() {
  const start = Date.now();
  let first = 0;
  const r = await characterTurn({ config, history, session: 'try' }, () => {
    first ||= Date.now() - start;
  });
  console.log(`  [thought] ${r.thought}`);
  console.log(`  BOT (mood ${r.mood}${r.hangup ? ', HANGS UP' : ''}): ${r.reply}`);
  console.log(`  first spoken word after ${first} ms, full turn ${Date.now() - start} ms\n`);
  history.push({ role: 'bot', text: r.reply, thought: r.thought, mood: r.mood, at: Date.now() - t0 });
  return r;
}

await bot();
for (const line of script) {
  console.log(`YOU: ${line}`);
  history.push({ role: 'user', text: line, at: Date.now() - t0 });
  const r = await bot();
  if (r.hangup) break;
}
console.log(`Spent: $${ledger.spentToday().toFixed(4)}`);
