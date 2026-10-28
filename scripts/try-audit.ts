// Audits a short, deliberately weak call with the live auditor.
// Run: npm run try:audit            (English)
//      npm run try:audit -- --lang pl
import { audit } from '../server/agents/auditor.ts';
import { rollVariant } from '../shared/variation.ts';
import type { Lang, SessionConfig, Turn } from '../shared/types.ts';

const variant = 12345;
const argv = process.argv.slice(2);
const lang: Lang = argv.includes('--lang') && argv[argv.indexOf('--lang') + 1] === 'pl' ? 'pl' : 'en';
const v = rollVariant('sales', variant, lang);
const config: SessionConfig =
  lang === 'pl'
    ? { scenario: 'sales', level: 3, topic: 'Przebudowa strony internetowej, 12 000 zł', persona: v.persona, variant, lang, user: { gender: 'm', formal: true } }
    : { scenario: 'sales', level: 3, topic: 'Website redesign, 3,000 USD', persona: v.persona, variant };
const EN: Turn[] = [
  { role: 'bot', text: 'Elena Moretti. You have thirty seconds.', thought: 'Unknown number, keep it short.', mood: 3, at: 0 },
  { role: 'user', text: 'Um, hi, so, I am Alex and I basically help companies, you know, with websites and stuff.', at: 6000 },
  { role: 'bot', text: 'What stuff, exactly? What is wrong with mine?', thought: 'Vague. Make him be specific.', mood: 2, at: 8000 },
  { role: 'user', text: 'Your site loads in seven seconds on a phone, I measured it this morning, and most visitors leave before three.', at: 19000 },
  { role: 'bot', text: 'Seven seconds? That is a real number. What does fixing it cost?', thought: 'He measured it. Now I am curious.', mood: 4, at: 22000 },
  { role: 'user', text: 'It depends, um, we can talk about price later, I just want to book a meeting.', at: 31000 },
  { role: 'bot', text: 'No price, no meeting. I have a bakery to run.', thought: 'He dodged the one question I asked. Losing him.', mood: 2, at: 34000, },
];
const PL: Turn[] = [
  { role: 'bot', text: 'Słucham. Ma Pan pół minuty.', thought: 'Nieznany numer, niech mówi krótko.', mood: 3, at: 0 },
  { role: 'user', text: 'Yyy, dzień dobry, no więc jestem Adam i zajmuję się, no, stronami internetowymi i takimi tam.', at: 6000 },
  { role: 'bot', text: 'Jakimi "takimi tam"? Co jest nie tak z moją stroną?', thought: 'Mętnie. Niech powie konkretnie.', mood: 2, at: 8000 },
  { role: 'user', text: 'Pani strona ładuje się na telefonie siedem sekund, zmierzyłem to dziś rano, i większość ludzi wychodzi przed trzecią sekundą.', at: 19000 },
  { role: 'bot', text: 'Siedem sekund? To konkretna liczba. Ile kosztuje naprawa?', thought: 'Zmierzył to. Zaczyna mnie to ciekawić.', mood: 4, at: 22000 },
  { role: 'user', text: 'To zależy, w sumie o cenie pogadamy później, chcę po prostu umówić spotkanie.', at: 31000 },
  { role: 'bot', text: 'Bez ceny nie ma spotkania. Mam piekarnię do prowadzenia.', thought: 'Uciekł od jedynego pytania, które zadałam. Tracę go.', mood: 2, at: 34000 },
];
const turns = lang === 'pl' ? PL : EN;

const t0 = Date.now();
const r = await audit({ config, turns, durationMs: 40000, hungUp: false, session: 'try-audit' });
console.log(`Audit in ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);
console.log(JSON.stringify(r, null, 2));
