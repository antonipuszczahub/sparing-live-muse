import { z } from 'zod';
import { scenarioDef } from '../../shared/scenarios.ts';
import type { Lang, ScenarioId, TwinProfile } from '../../shared/types.ts';
import { complete } from '../meta/client.ts';
import { MODELS } from '../meta/models.ts';
import { respond, type ResponseStep } from '../meta/responses.ts';

const TwinSchema = z.object({
  company: z.string().min(1),
  buyerRole: z.string().min(1),
  buyerBio: z.string().min(1),
  summary: z.string().min(1),
  customers: z.string(),
  pains: z.array(z.string()).min(1).max(6),
  objections: z.array(z.string()).min(1).max(6),
  vocabulary: z.array(z.string()).max(10),
});

/** The keys stay English in every language (the schema reads them); only the values change language. */
const JSON_SHAPE = {
  en: `{
  "company": "official company name",
  "buyerRole": "job title of the person on the other side of the call",
  "buyerBio": "2 sentences about this fictional person: what they own, what they are measured on, how they react to pitches",
  "summary": "3 sentences: what the company does, size and stage, how it makes money",
  "customers": "who the company's own customers are",
  "pains": ["3 to 5 specific problems the company currently has, visible in public sources"],
  "objections": ["3 to 5 objections this counterpart would REALLY raise to the user's pitch, phrased as they would say it"],
  "vocabulary": ["6 to 10 words or phrases this company actually uses on its site and in its docs"]
}`,
  pl: `{
  "company": "oficjalna nazwa firmy",
  "buyerRole": "stanowisko osoby po drugiej stronie rozmowy, po polsku, np. Dyrektor ds. produktu",
  "buyerBio": "2 zdania o tej fikcyjnej osobie: za co odpowiada, z czego jest rozliczana, jak reaguje na oferty i prezentacje",
  "summary": "3 zdania: czym zajmuje się firma, jej wielkość i etap, na czym zarabia",
  "customers": "kim są klienci tej firmy",
  "pains": ["od 3 do 5 konkretnych problemów, które firma ma obecnie, widocznych w publicznych źródłach"],
  "objections": ["od 3 do 5 zastrzeżeń, które ten rozmówca NAPRAWDĘ zgłosiłby do oferty użytkownika, sformułowanych tak, jak by je powiedział"],
  "vocabulary": ["od 6 do 10 słów lub zwrotów, których firma naprawdę używa na swojej stronie i w dokumentacji"]
}`,
} satisfies Record<Lang, string>;

const BRIEF: Record<Lang, Record<ScenarioId, string>> = {
  en: {
    sales: 'The user will cold-call this company to sell: "{topic}". The counterpart is the person who would decide or influence the purchase.',
    defense: 'The user will defend: "{topic}" in front of an examiner connected to this organisation. The counterpart is an examiner there.',
    salary: 'The user works at (or is joining) this company and will negotiate pay: "{topic}". The counterpart is their manager. Focus on the company situation: growth, funding, layoffs, how it pays and what it values.',
    pitch: 'The user will pitch an investor at this fund/firm: "{topic}". The counterpart is a partner. Focus on the thesis, stage, check size, portfolio and what they have passed on.',
  },
  pl: {
    sales: 'Użytkownik zadzwoni do tej firmy, żeby sprzedać: „{topic}”. Rozmówcą jest osoba, która decydowałaby o zakupie albo miała na niego wpływ.',
    defense: 'Użytkownik będzie bronić: „{topic}” przed egzaminatorem związanym z tą organizacją. Rozmówcą jest egzaminator z tej organizacji.',
    salary: 'Użytkownik pracuje w tej firmie (albo do niej dołącza) i będzie negocjować wynagrodzenie: „{topic}”. Rozmówcą jest jego przełożony. Skup się na sytuacji firmy: wzroście, finansowaniu, zwolnieniach, tym, jak płaci i co ceni.',
    pitch: 'Użytkownik zaprezentuje inwestorowi z tego funduszu albo firmy: „{topic}”. Rozmówcą jest partner. Skup się na tezie inwestycyjnej, etapie, wielkości czeków, portfolio i tym, co fundusz odrzucił.',
  },
};

/** The profile becomes a character of a known gender, and Polish text about a person agrees with it. */
const genderRulePl = (gender?: 'm' | 'f'): string =>
  gender
    ? `- Ta osoba jest ${gender === 'f' ? 'kobietą' : 'mężczyzną'}: w polu buyerBio pisz o niej we właściwym rodzaju (np. ${gender === 'f' ? '„jest rozliczana”' : '„jest rozliczany”'}), a stanowisko podaj w formie, jaką zwykle pisze się na wizytówce.`
    : '- Nie znasz płci tej osoby: w polu buyerBio unikaj form wymagających rodzaju.';

const PROMPT: Record<Lang, (o: { company: string; scenarioTitle: string; brief: string; gender?: 'm' | 'f' }) => string> = {
  en: ({ company, scenarioTitle, brief }) => `You prepare a realistic practice partner for a high-stakes conversation. Research the company below with web search (use several searches and open its own site), then describe it.

Company or website: ${company}
Scenario: ${scenarioTitle}. ${brief}

Rules:
- Use only what you actually found. If something is unknown, say so briefly instead of inventing it.
- The counterpart is a fictional person in a role at this company. Never name or describe a real employee.
- Pains and objections must be specific to THIS company (their product, market, size, recent news), not generic.
- Work quickly: 3 to 6 searches are enough.
- Your final message must contain ONLY this JSON object, no commentary:
${JSON_SHAPE.en}`,
  pl: ({ company, scenarioTitle, brief, gender }) => `Przygotowujesz realistycznego partnera do ćwiczeń przed ważną rozmową. Zbadaj poniższą firmę wyszukiwarką internetową (zrób kilka wyszukiwań, także po polsku i po angielsku, i otwórz jej własną stronę), a potem ją opisz.

Firma lub strona: ${company}
Scenariusz: ${scenarioTitle}. ${brief}

Zasady:
- Używaj wyłącznie tego, co faktycznie znajdziesz. Jeśli czegoś nie wiesz, napisz to krótko zamiast wymyślać.
- Rozmówca jest fikcyjną osobą na stanowisku w tej firmie. Nigdy nie wymieniaj ani nie opisuj prawdziwego pracownika.
${genderRulePl(gender)}
- Bolączki i zastrzeżenia muszą dotyczyć TEJ firmy (jej produktu, rynku, wielkości, ostatnich wiadomości), a nie być ogólnikami.
- Pracuj szybko: wystarczy od 3 do 6 wyszukiwań.
- Wszystkie wartości w JSON napisz po polsku, nawet jeśli firma działa po angielsku. Wyjątek: pole "vocabulary" zostaw w języku, w którym firma pisze na swojej stronie.
- Twoja ostatnia wiadomość ma zawierać WYŁĄCZNIE ten obiekt JSON, bez komentarza:
${JSON_SHAPE.pl}`,
};

const TEXT: Record<Lang, { structuring: string; convert: string; noNotes: string }> = {
  en: { structuring: 'Structuring the findings…', convert: 'Convert the research notes into exactly this JSON shape, filling only from the notes:', noNotes: 'No notes.' },
  pl: { structuring: 'Porządkuję wyniki…', convert: 'Przepisz notatki z badania dokładnie na ten kształt JSON, wypełniając go wyłącznie na podstawie notatek. Wartości zostaw po polsku:', noNotes: 'Brak notatek.' },
};

export interface TwinInput {
  company: string;
  scenario: ScenarioId;
  topic: string;
  session: string;
  /** Language of the call: the research is written up in it. Missing means English. */
  lang?: Lang;
  /** Gender of the character the profile becomes; Polish text about a person has to agree with it. */
  gender?: 'm' | 'f';
  signal?: AbortSignal;
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Digital twin: Muse Wonder researches a real company with live web search and returns a
 * profile the character is built from. Every step of the research is reported through onStep.
 */
export async function buildTwin(input: TwinInput, onStep: (s: ResponseStep) => void): Promise<TwinProfile> {
  const lang = input.lang ?? 'en';
  const sc = scenarioDef(input.scenario, lang);
  const prompt = PROMPT[lang]({ company: input.company, scenarioTitle: sc.title, brief: BRIEF[lang][input.scenario].replace('{topic}', input.topic), gender: input.gender });

  const res = await respond(
    {
      model: MODELS.wonder,
      input: prompt,
      kind: 'twin-research',
      session: input.session,
      effort: 'low',
      maxOutputTokens: 6000,
      webSearch: { contextSize: 'low' },
      signal: input.signal,
    },
    onStep,
  );

  let parsed: z.infer<typeof TwinSchema>;
  try {
    parsed = TwinSchema.parse(extractJson(res.text));
  } catch {
    // The research is good but the formatting is not: ask Spark to put it into the shape.
    onStep({ kind: 'note', text: TEXT[lang].structuring });
    const fixed = await complete({
      model: MODELS.spark,
      kind: 'twin-format',
      session: input.session,
      maxTokens: 2500,
      effort: 'minimal',
      messages: [
        { role: 'system', content: `${TEXT[lang].convert}\n${JSON_SHAPE[lang]}` },
        { role: 'user', content: res.text || TEXT[lang].noNotes },
      ],
    });
    parsed = TwinSchema.parse(extractJson(fixed));
  }

  const url = /^https?:\/\//.test(input.company) ? input.company : res.sources[0]?.url ?? '';
  return { ...parsed, url, sources: res.sources.slice(0, 8).map((s) => s.url) };
}
