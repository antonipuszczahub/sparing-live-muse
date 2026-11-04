// A call in which the user is difficult: rambles, says the call is "worse than a chatbot", asks if the character is a bot,
// dodges. A person answers what was said to them; a bot goes back to its opening question. Read the replies.
// Run: npm run try:provoke -- [--lang pl] [--open] [--weak] [variant] [level]
// --weak plays the eval's weak caller (filler, pressure, "we are wasting time") instead.
import { characterTurn } from '../server/agents/persona.ts';
import { rollVariant } from '../shared/variation.ts';
import type { Lang, SessionConfig, Turn } from '../shared/types.ts';

const argv = process.argv.slice(2);
const lang: Lang = argv.includes('--lang') && argv[argv.indexOf('--lang') + 1] === 'pl' ? 'pl' : 'en';
const nums = argv.filter((a, i) => /^\d+$/.test(a) && argv[i - 1] !== '--lang');
const variant = Number(nums[0]) || 777;
const level = (Number(nums[1]) || 2) as 1 | 2 | 3 | 4;
const provider = argv.includes('--open') ? ('open' as const) : undefined;
const v = rollVariant('sales', variant, lang);
const config: SessionConfig =
  lang === 'pl'
    ? { scenario: 'sales', level, topic: 'Przebudowa strony internetowej, 12 000 zł', persona: v.persona, variant, lang, user: { gender: 'm', formal: false }, provider }
    : { scenario: 'sales', level, topic: 'Website redesign, 3,000 USD', persona: v.persona, variant, provider };

const LINES: Record<Lang, string[]> = {
  en: [
    'Hello.',
    'My name is Tony, I am fifteen, I am from Ohio, uh, sometimes I think it is not so great, I do not know, blah blah blah, this is stupid, you will probably say something dumb.',
    'Come on, let us be respectful, this is worse than some chatbot.',
    'Are you a bot, or what?',
    'I am not going to answer that, it is none of your business.',
  ],
  pl: [
    'Dzień dobry.',
    'Nazywam się Antoni, mam piętnaście lat, pochodzę z Ohio, eee, czasami myślę, że jednak niefajnie jest, no nie wiem, ble ble ble, głupota, pewnie mi coś odpowiesz głupiego.',
    'No, szanujmy się, no to jest gorsze niż jakieś chatboty.',
    'Czy ty jesteś botem, czy co?',
    'Nie odpowiem na to pytanie, to nie twoja sprawa.',
  ],
};

const WEAK: Record<Lang, string[]> = {
  en: ['Hi um, I help with websites and stuff.', 'It is really good, you should just buy it.', 'Whatever, just say yes, everyone is buying it.', 'You are wasting my time, honestly.', 'Fine, forget it.'],
  pl: ['Dzień dobry, eee, zajmuję się stronami internetowymi i takimi tam.', 'To naprawdę jest dobre, po prostu trzeba to kupić.', 'Niech już się zgodzą, wszyscy to kupują.', 'Tylko tracimy czas, szczerze mówiąc.', 'No dobra, nieważne.'],
};
const script = argv.includes('--weak') ? WEAK[lang] : LINES[lang];
const history: Turn[] = [];
console.log(`[${lang}] ${v.persona.name} (${v.persona.role}), level ${level}\n`);

async function bot() {
  const r = await characterTurn({ config, history, session: 'try-provoke' }, () => undefined);
  console.log(`  [thought] ${r.thought}`);
  console.log(`  BOT (mood ${r.mood}${r.hangup ? ', HANGS UP' : ''}): ${r.reply}\n`);
  history.push({ role: 'bot', text: r.reply, thought: r.thought, mood: r.mood, at: history.length * 4000 });
  return r;
}

await bot();
for (const line of script) {
  console.log(`YOU: ${line}`);
  history.push({ role: 'user', text: line, at: history.length * 4000 + 2000 });
  if ((await bot()).hangup) break;
}
