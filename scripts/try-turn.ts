// Plays a short scripted call against the live character agent and prints latency per turn.
// Run: npm run try:turn            (English)
//      npm run try:turn -- --lang pl [variant] [level]
import { characterTurn } from '../server/agents/persona.ts';
import { ledger } from '../server/meta/ledger.ts';
import { rollVariant } from '../shared/variation.ts';
import type { Lang, SessionConfig, Turn } from '../shared/types.ts';

const argv = process.argv.slice(2);
const lang: Lang = argv.includes('--lang') && argv[argv.indexOf('--lang') + 1] === 'pl' ? 'pl' : 'en';
const nums = argv.filter((a, i) => /^\d+$/.test(a) && argv[i - 1] !== '--lang');
const variant = Number(nums[0]) || 12345;
const level = (Number(nums[1]) || 3) as 1 | 2 | 3 | 4;
const v = rollVariant('sales', variant, lang);

const config: SessionConfig =
  lang === 'pl'
    ? {
        scenario: 'sales',
        level,
        topic: 'Przebudowa ich strony internetowej, 12 000 zł, dwa tygodnie',
        persona: v.persona,
        variant,
        lang,
        // The caller in the script below is a woman, speaking formally ("Pani").
        user: { gender: 'f', formal: true },
      }
    : { scenario: 'sales', level, topic: 'A redesign of their website, 3,000 USD, two weeks', persona: v.persona, variant };

const SCRIPT: Record<Lang, string[]> = {
  en: [
    'Hi, this is Alex from Brightside Web. I help small companies get more customers from their website.',
    'Sure. Your current site loads in about seven seconds on a phone, and most visitors leave before it opens.',
    'We rebuild it in two weeks for three thousand dollars, and you only pay when you approve the result.',
  ],
  pl: [
    'Dzień dobry, mówi Alicja z Brightside Web. Pomagam małym firmom zdobywać klientów przez stronę internetową.',
    'Jasne. Strona Państwa firmy ładuje się na telefonie około siedmiu sekund i większość odwiedzających wychodzi, zanim się otworzy.',
    'Przebudowujemy ją w dwa tygodnie za dwanaście tysięcy złotych i Państwo płacą dopiero po zaakceptowaniu efektu.',
  ],
};

const history: Turn[] = [];
const t0 = Date.now();
console.log(`[${lang}] ${v.persona.name} (${v.persona.role}), level ${level}. Today: ${v.circumstance}\n`);

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
for (const line of SCRIPT[lang]) {
  console.log(`YOU: ${line}`);
  history.push({ role: 'user', text: line, at: Date.now() - t0 });
  const r = await bot();
  if (r.hangup) break;
}
console.log(`Spent: $${ledger.spentToday().toFixed(4)}`);
