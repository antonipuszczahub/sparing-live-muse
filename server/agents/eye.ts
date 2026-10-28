import { scenarioDef } from '../../shared/scenarios.ts';
import type { Lang, ScenarioId } from '../../shared/types.ts';
import { complete } from '../meta/client.ts';
import { MODELS } from '../meta/models.ts';

export interface EyeInput {
  /** data:image/jpeg;base64,... of the user's shared screen. */
  image: string;
  scenario: ScenarioId;
  topic: string;
  session: string;
  /** Language of the call: the notes are written in it. Missing means English. */
  lang?: Lang;
  signal?: AbortSignal;
}

const SYSTEM: Record<Lang, (o: { title: string; topic: string }) => string> = {
  en: ({ title, topic }) => `You are the eyes of someone sitting across from the user on a ${title} call. The user (topic: "${topic}") is sharing their screen. Write the notes this person would jot down. Rules:
- Say what it is first (slide, code file, website, document, spreadsheet, something else) and which one if numbered.
- Copy visible text exactly: titles, headline numbers, labels, and up to 12 lines of code verbatim with their line numbers when shown. Never invent text you cannot read.
- Then list up to 3 things a sharp, skeptical counterpart would pounce on: missing evidence, unclear numbers, typos, risky code, weak claims.
- Under 170 words, plain text, no markdown, do not address the user.`,
  pl: ({ title, topic }) => `Jesteś oczami osoby, która siedzi naprzeciwko użytkownika podczas rozmowy: ${title}. Użytkownik (temat: „${topic}”) udostępnia swój ekran. Napisz notatki, które ta osoba by sobie zrobiła. Zasady:
- Najpierw napisz, co to jest (slajd, plik z kodem, strona internetowa, dokument, arkusz, coś innego) i który z kolei, jeśli jest numerowany.
- Przepisuj widoczny tekst dokładnie: tytuły, główne liczby, etykiety oraz do 12 linijek kodu dosłownie, z numerami linii, jeśli są widoczne. Nigdy nie zmyślaj tekstu, którego nie możesz odczytać.
- Potem wymień do 3 rzeczy, na które rzuciłby się wnikliwy, sceptyczny rozmówca: brak dowodów, niejasne liczby, literówki, ryzykowny kod, słabe twierdzenia.
- Poniżej 170 słów, zwykły tekst, bez markdownu, nie zwracaj się do użytkownika. Notatki pisz po polsku, a cytaty z ekranu zostaw w oryginale.`,
};

const SEEN: Record<Lang, string> = { en: 'Here is the shared screen right now.', pl: 'Oto ekran użytkownika w tej chwili.' };

/**
 * The eye agent looks at the user's shared screen (slides, code, a portfolio site) and writes
 * the notes a sharp counterpart would take. The character reads these notes as if it could see.
 */
export async function look(input: EyeInput): Promise<string> {
  const lang = input.lang ?? 'en';
  const sc = scenarioDef(input.scenario, lang);
  const text = await complete({
    model: MODELS.spark,
    kind: 'eye',
    session: input.session,
    maxTokens: 900,
    effort: 'minimal',
    signal: input.signal,
    messages: [
      { role: 'system', content: SYSTEM[lang]({ title: sc.title.toLowerCase(), topic: input.topic }) },
      {
        role: 'user',
        content: [
          { type: 'text', text: SEEN[lang] },
          { type: 'image_url', image_url: { url: input.image } },
        ],
      },
    ],
  });
  return text.trim();
}
