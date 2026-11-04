import type { AuditResult } from '../../shared/audit.ts';
import type { TraceRow } from '../../shared/trace.ts';
import type { Lang, SessionConfig, Turn } from '../../shared/types.ts';

/**
 * A recorded call and its review, made up for the "sample" screen and the development fixtures: the interface can be
 * seen without a key and without a single model call. The numbers in the trace are the kind the real ledger reports
 * for a call like this; nothing here comes from a live run.
 */
export function sampleConfig(lang: Lang): SessionConfig {
  return lang === 'pl'
    ? {
        scenario: 'pitch',
        level: 2,
        topic: 'Aplikacja do umawiania wizyt w gabinetach stomatologicznych',
        persona: { name: 'Dorota Wiśniewska', role: 'Partnerka w funduszu seed', gender: 'f', bio: 'Wypisuje małe czeki i pamięta każdą liczbę.' },
        variant: 3,
        provider: 'open',
        lang: 'pl',
        user: { gender: 'm', formal: true },
      }
    : {
        scenario: 'pitch',
        level: 2,
        topic: 'A scheduling tool for dental clinics',
        persona: { name: 'Dana Whitfield', role: 'Partner at a seed fund', gender: 'f', bio: 'Writes small checks, remembers every number.' },
        variant: 3,
        provider: 'open',
        lang: 'en',
      };
}

const TURNS_EN: Turn[] = [
  { role: 'bot', text: 'Three minutes, you said. I have heard a lot about the market and nothing about who pays you.', thought: 'Another market slide. Show me one invoice.', mood: 3, at: 12000 },
  { role: 'user', text: 'Fair. Two dental chains are our first customers, and one already paid for a pilot.', at: 31000 },
  { role: 'bot', text: 'How much, and for how long? A pilot can mean anything from a free trial to a real contract.', thought: 'If it is paid, I will lean in. If it is free, this is a hobby.', mood: 2, at: 41000 },
  { role: 'user', text: 'Eight hundred a month per clinic, six months, signed in September.', at: 62000 },
  { role: 'bot', text: 'Six months is a trial, not a business. What happens when it ends?', thought: 'Real money, but six months proves nothing. Make me believe in year two.', mood: 3, at: 78000 },
  { role: 'user', text: 'We think the market is, uh, you know, really big, like forty billion, and we are, um, just getting started.', at: 101000 },
  { role: 'bot', text: 'I asked about renewal, not the market.', thought: 'Four fillers in one breath. I am losing interest.', mood: 2, at: 118000 },
  { role: 'user', text: 'Right. Both clinics renewed for another year, and a third signs next month.', at: 139000 },
  { role: 'bot', text: 'Now that is a sentence I can write down. Send me the contract terms.', thought: 'There it is. A number, a renewal, a next step.', mood: 4, at: 152000 },
];

const TURNS_PL: Turn[] = [
  { role: 'bot', text: 'Trzy minuty, mówił Pan. Usłyszałam dużo o rynku i nic o tym, kto Panu płaci.', thought: 'Kolejny slajd o rynku. Niech pokaże jedną fakturę.', mood: 3, at: 12000 },
  { role: 'user', text: 'Słusznie. Pierwszymi klientami są dwie sieci stomatologiczne, a jedna już zapłaciła za pilotaż.', at: 31000 },
  { role: 'bot', text: 'Ile i na jak długo? Pilotaż może znaczyć wszystko, od darmowego testu po prawdziwą umowę.', thought: 'Jeśli płatny, pochylę się. Jeśli darmowy, to hobby.', mood: 2, at: 41000 },
  { role: 'user', text: 'Osiemset złotych miesięcznie za gabinet, sześć miesięcy, podpisane we wrześniu.', at: 62000 },
  { role: 'bot', text: 'Sześć miesięcy to próba, nie biznes. Co się stanie, gdy się skończy?', thought: 'Prawdziwe pieniądze, ale pół roku nic nie dowodzi. Niech mnie przekona co do drugiego roku.', mood: 3, at: 78000 },
  { role: 'user', text: 'Uważamy, że rynek jest, no, wie Pani, naprawdę duży, jakieś czterdzieści miliardów, a my, yyy, dopiero zaczynamy.', at: 101000 },
  { role: 'bot', text: 'Pytałam o przedłużenie umowy, nie o rynek.', thought: 'Cztery wypełniacze w jednym oddechu. Tracę zainteresowanie.', mood: 2, at: 118000 },
  { role: 'user', text: 'Racja. Oba gabinety przedłużyły umowę o kolejny rok, a trzeci podpisuje w przyszłym miesiącu.', at: 139000 },
  { role: 'bot', text: 'To jest zdanie, które mogę zapisać. Proszę przysłać warunki umowy.', thought: 'Jest. Liczba, przedłużenie, następny krok.', mood: 4, at: 152000 },
];

export const sampleTurns = (lang: Lang): Turn[] => (lang === 'pl' ? TURNS_PL : TURNS_EN);

const RESULT_EN: AuditResult = {
  score: 58,
  outcome: 'partial',
  verdict: 'You had a paying customer and kept it hidden for ninety seconds.',
  summary: 'Dana opened cold and warmed up only after you named the pilot. The pitch lost ground whenever you reached for the size of the market instead of a number you could prove.',
  skills: { clarity: 7, listening: 4, objections: 5, specificity: 3, composure: 6 },
  moments: [
    { turn: 1, kind: 'strength', what: 'You answered with a fact, not a claim.', why: 'A paid pilot says who pays you in one sentence. Dana’s attitude moved from cold to neutral right after it.' },
    {
      turn: 5,
      kind: 'mistake',
      what: 'Dana asked about renewal and you gave her a market size.',
      why: 'Four filler words in one breath, and the one number she wanted never came.',
      betterLine: 'Eight hundred dollars a month per clinic. Two clinics today, and a third signs next month.',
    },
  ],
  nextFocus: ['Lead with the paying customer in your first ten seconds.', 'State the price before you are asked.', 'Answer in two sentences, then stop.'],
  weaknessTags: [],
};

const RESULT_PL: AuditResult = {
  score: 58,
  outcome: 'partial',
  verdict: 'Miał Pan płacącego klienta i ukrywał go przez dziewięćdziesiąt sekund.',
  summary: 'Dorota zaczęła chłodno i ocieplała się dopiero, gdy wymienił Pan pilotaż. Oferta traciła grunt za każdym razem, gdy sięgał Pan po wielkość rynku zamiast po liczbę, którą da się udowodnić.',
  skills: { clarity: 7, listening: 4, objections: 5, specificity: 3, composure: 6 },
  moments: [
    { turn: 1, kind: 'strength', what: 'Odpowiedział Pan faktem, nie twierdzeniem.', why: 'Płatny pilotaż w jednym zdaniu mówi, kto Panu płaci. Nastawienie Doroty zmieniło się zaraz po nim z chłodnego na neutralne.' },
    {
      turn: 5,
      kind: 'mistake',
      what: 'Dorota zapytała o przedłużenie umowy, a Pan podał wielkość rynku.',
      why: 'Cztery wypełniacze w jednym oddechu i jedna liczba, na której jej zależało, nie padła.',
      betterLine: 'Osiemset złotych miesięcznie za gabinet. Dwa gabinety dziś, a trzeci podpisuje w przyszłym miesiącu.',
    },
  ],
  nextFocus: ['Zacznij od płacącego klienta w pierwszych dziesięciu sekundach.', 'Podaj cenę, zanim o nią zapytają.', 'Odpowiadaj dwoma zdaniami, potem przestań.'],
  weaknessTags: [],
};

export const sampleResult = (lang: Lang): AuditResult => (lang === 'pl' ? RESULT_PL : RESULT_EN);

/** Which models ran a call like this one, in the shape the ledger reports (made up here). */
export const SAMPLE_TRACE: TraceRow[] = [
  { kind: 'asr', model: 'muse-voice-transcribe-1.0', served: 'Meta Model API', open: false, calls: 1, medianMs: null, costUsd: 0.002 },
  { kind: 'character-turn', model: 'meta-models/muse-spark-open-1026', served: 'Open weights · Baseten', open: true, calls: 9, medianMs: 1480, costUsd: 0 },
  { kind: 'eye', model: 'muse-spark-1.3', served: 'Meta Model API', open: false, calls: 1, medianMs: 2700, costUsd: 0.003 },
  { kind: 'twin-research', model: 'muse-wonder-1.0', served: 'Meta Model API', open: false, calls: 1, medianMs: 29800, costUsd: 0.16 },
  { kind: 'portrait', model: 'muse-image-1.0', served: 'Meta Model API', open: false, calls: 1, medianMs: 8600, costUsd: 0.01 },
  { kind: 'portrait-edit', model: 'muse-image-1.0', served: 'Meta Model API', open: false, calls: 2, medianMs: 16100, costUsd: 0.02 },
  { kind: 'audit', model: 'muse-wonder-1.0', served: 'Meta Model API', open: false, calls: 1, medianMs: 13200, costUsd: 0.04 },
];
