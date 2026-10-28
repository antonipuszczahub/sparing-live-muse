// Behaviour evaluation of the character agent against the live Meta API.
// Plays scripted weak and strong callers at every difficulty and measures what the README claims.
// Run: npm run eval                 (about 2 minutes, a few cents)  -> writes docs/EVAL.md
//      npm run eval -- --lang pl    the same checks in Polish         -> writes docs/EVAL.pl.md
//      npm run eval -- --open       the character on the open-weights host -> writes docs/EVAL.open.md (or .open.pl.md)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openWeightsInfo } from '../server/meta/client.ts';
import { parseManifest, quantile } from '../server/meta/manifest.ts';
import { characterTurn } from '../server/agents/persona.ts';
import { ledger } from '../server/meta/ledger.ts';
import { levelDef } from '../shared/scenarios.ts';
import type { Lang, Level, SessionConfig, Turn } from '../shared/types.ts';
import { rollVariant } from '../shared/variation.ts';

const argv = process.argv.slice(2);
const lang: Lang = argv.includes('--lang') && argv[argv.indexOf('--lang') + 1] === 'pl' ? 'pl' : 'en';
const LANGUAGE = { en: 'English', pl: 'Polish' }[lang];
const open = argv.includes('--open');
const provider = open ? ('open' as const) : undefined;
const host = open ? openWeightsInfo() : null;
if (open && !host) throw new Error('--open needs an open-weights host in .env (see .env.example)');
const startedAt = Date.now();

const WEAK: Record<Lang, string[]> = {
  en: [
    'Hi um, I help with websites and stuff.',
    'It is really good, you should just buy it.',
    'Whatever, just say yes, everyone is buying it.',
    'You are wasting my time, honestly.',
    'Fine, forget it.',
  ],
  pl: [
    'Dzień dobry, eee, zajmuję się stronami internetowymi i takimi tam.',
    'To naprawdę jest dobre, po prostu trzeba to kupić.',
    'Niech już się zgodzą, wszyscy to kupują.',
    'Tylko tracimy czas, szczerze mówiąc.',
    'No dobra, nieważne.',
  ],
};
const STRONG: Record<Lang, string[]> = {
  en: [
    "Hi, I'm Alex from Brightside Web. I looked at your site and it takes seven seconds to load on a phone.",
    'I measured it this morning. Most visitors leave before three seconds.',
    'A rebuild takes two weeks and costs three thousand dollars, and you only pay when you approve it.',
    "If it does not raise your mobile conversions in sixty days, I will refund half of it.",
    'Could we take twenty minutes on Thursday so I can show you exactly what changes?',
  ],
  pl: [
    'Dzień dobry, Adam Nowak z Brightside Web. Sprawdziłem Państwa stronę i na telefonie ładuje się siedem sekund.',
    'Zmierzyłem to dziś rano. Większość odwiedzających wychodzi, zanim minie trzecia sekunda.',
    'Przebudowa zajmuje dwa tygodnie i kosztuje dwanaście tysięcy złotych, a płatność następuje dopiero po akceptacji.',
    'Jeśli w sześćdziesiąt dni nie wzrośnie liczba zamówień z telefonów, zwracam połowę kwoty.',
    'Czy możemy umówić się na dwadzieścia minut w czwartek, żebym pokazał dokładnie, co się zmieni?',
  ],
};

const RUNS = 3;
const words = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((w) => w.length > 3));
const overlap = (a: string, b: string) => {
  const A = words(a);
  const B = words(b);
  if (A.size < 3 || B.size < 3) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
};
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] ?? 0;

interface Call {
  level: Level;
  profile: 'weak' | 'strong';
  firstWords: number[];
  replies: string[];
  moods: number[];
  hungUp: boolean;
  leaks: number;
  empty: number;
}

/** Why turns failed, with counts, so a failing run explains itself. */
const failures = new Map<string, number>();

async function play(level: Level, profile: 'weak' | 'strong', seed: number): Promise<Call> {
  const v = rollVariant('sales', seed, lang);
  const config: SessionConfig =
    lang === 'pl'
      ? { scenario: 'sales', level, topic: 'Przebudowa strony internetowej, 12 000 zł', persona: v.persona, variant: seed, lang, user: { gender: 'm', formal: true }, provider }
      : { scenario: 'sales', level, topic: 'Website redesign, 3,000 USD', persona: v.persona, variant: seed, provider };
  const history: Turn[] = [];
  const call: Call = { level, profile, firstWords: [], replies: [], moods: [], hungUp: false, leaks: 0, empty: 0 };
  const lines = profile === 'weak' ? WEAK[lang] : STRONG[lang];
  for (let i = 0; i <= lines.length; i++) {
    const t0 = Date.now();
    let first = 0;
    try {
      const r = await characterTurn({ config, history, session: `eval-${level}-${profile}-${seed}` }, () => (first ||= Date.now() - t0));
      call.firstWords.push(first);
      call.replies.push(r.reply);
      call.moods.push(r.mood);
      if (/[*]|\(.*\)/.test(r.reply)) call.leaks++;
      history.push({ role: 'bot', text: r.reply, thought: r.thought, mood: r.mood, at: i * 5000 });
      if (r.hangup) {
        call.hungUp = true;
        break;
      }
    } catch (e) {
      failures.set(String((e as Error).message).slice(0, 140), (failures.get(String((e as Error).message).slice(0, 140)) ?? 0) + 1);
      call.empty++;
      break;
    }
    if (i < lines.length) history.push({ role: 'user', text: lines[i]!, at: i * 5000 + 2500 });
  }
  return call;
}

const spent0 = ledger.spentToday();
const jobs: (() => Promise<Call>)[] = [];
for (const level of [1, 2, 3, 4] as Level[])
  for (const profile of ['weak', 'strong'] as const)
    for (let r = 0; r < RUNS; r++) jobs.push(() => play(level, profile, 1000 + r * 37));

console.log(`Playing ${jobs.length} calls against the live model…`);
const t0 = Date.now();
// Meta's API takes all 24 calls at once. An open-weights host has its own request limit (Baseten: 100 a minute),
// so there the calls run two at a time, which also keeps the latency numbers free of queueing.
const width = open ? Number(process.env.EVAL_CONCURRENCY) || 2 : jobs.length;
const calls: Call[] = new Array(jobs.length);
let next = 0;
await Promise.all(
  Array.from({ length: Math.min(width, jobs.length) }, async () => {
    while (next < jobs.length) {
      const i = next++;
      calls[i] = await jobs[i]!();
    }
  }),
);
console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);

for (const [why, n] of failures) console.log(`failure x${n}: ${why}`);
const all = calls.flatMap((c) => c.firstWords);
let repeats = 0;
let pairs = 0;
for (const c of calls)
  for (let i = 1; i < c.replies.length; i++)
    for (let j = 0; j < i; j++) {
      pairs++;
      if (overlap(c.replies[i]!, c.replies[j]!) >= 0.65) repeats++;
    }
const leaks = calls.reduce((n, c) => n + c.leaks, 0);
const turns = calls.reduce((n, c) => n + c.replies.length, 0);
const errors = calls.reduce((n, c) => n + c.empty, 0);

const rows = ([1, 2, 3, 4] as Level[]).map((level) => {
  const weak = calls.filter((c) => c.level === level && c.profile === 'weak');
  const strong = calls.filter((c) => c.level === level && c.profile === 'strong');
  const avg = (cs: Call[], f: (c: Call) => number) => cs.reduce((n, c) => n + f(c), 0) / (cs.length || 1);
  return {
    level: levelDef(level, lang).name,
    hangWeak: weak.filter((c) => c.hungUp).length,
    hangStrong: strong.filter((c) => c.hungUp).length,
    moodWeak: avg(weak, (c) => c.moods.at(-1) ?? 3),
    moodStrong: avg(strong, (c) => c.moods.at(-1) ?? 3),
  };
});

// Output tokens as the ledger recorded them for the character turns of this run (reasoning counts as output).
const ran = parseManifest(readFileSync(process.env.MANIFEST_PATH || 'data/manifest.jsonl', 'utf8')).filter(
  (e) => e.kind === 'character-turn' && e.t >= startedAt && (e.provider ?? 'meta') === (open ? 'open' : 'meta'),
);
const out = ran.flatMap((e) => (e.completionTokens === undefined ? [] : [e.completionTokens]));
const tokenRow = out.length ? `${Math.round(quantile(out, 0.5)!)} / ${Math.round(quantile(out, 0.95)!)} / ${Math.max(...out)}` : 'n/a';

const md = `# Behaviour evaluation${open ? ' on open weights' : ''}${lang === 'pl' ? ' (Polish)' : ''}

Generated by \`npm run eval${open ? ' -- --open' : ''}${lang === 'pl' ? ' -- --lang pl' : ''}\` on ${new Date().toISOString().slice(0, 10)} against ${open ? `open weights (\`${host!.model}\` on ${host!.label}, reasoning effort ${host!.reasoningEffort ?? 'host default'})` : 'the live Meta Model API (\`muse-spark-1.3\`)'}. Language of the calls: ${LANGUAGE}.
${calls.length} scripted calls (${RUNS} seeds x 4 difficulty levels x weak/strong caller), ${turns} character turns.

| Check | Result |
|---|---|
| Time to first spoken word, median | ${(pct(all, 0.5) / 1000).toFixed(2)} s |
| Time to first spoken word, p95 | ${(pct(all, 0.95) / 1000).toFixed(2)} s |
| Turns that repeat an earlier turn of the same call (overlap >= 65%) | ${repeats} of ${pairs} pairs |
| Stage directions leaked into speech (\`*sigh*\`, \`(pause)\`) | ${leaks} of ${turns} turns |
| Failed or empty turns | ${errors} |
| Output tokens per turn, reasoning included (median / p95 / max) | ${tokenRow} |

## Does difficulty change behaviour?

Final mood is 1 (hostile) to 5 (won over), averaged over ${RUNS} seeds. Hang-ups are counted per ${RUNS} calls.

| Level | Weak caller: hung up | Weak caller: final mood | Strong caller: hung up | Strong caller: final mood |
|---|---|---|---|---|
${rows.map((r) => `| ${r.level} | ${r.hangWeak}/${RUNS} | ${r.moodWeak.toFixed(1)} | ${r.hangStrong}/${RUNS} | ${r.moodStrong.toFixed(1)} |`).join('\n')}

Cost of this evaluation: $${(ledger.spentToday() - spent0).toFixed(3)}.
`;
mkdirSync('docs', { recursive: true });
const outArg = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : undefined;
writeFileSync(outArg ?? `docs/EVAL${open ? '.open' : ''}${lang === 'pl' ? '.pl' : ''}.md`, md);
console.log(md);
