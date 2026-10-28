import { langOf } from '../../shared/lang.ts';
import { scenarioDef } from '../../shared/scenarios.ts';
import { AUDIT_SCHEMA, ensureVerdict, measureDelivery, type AuditResult } from '../../shared/audit.ts';
import type { Lang, SessionConfig, Turn } from '../../shared/types.ts';
import { rollVariant } from '../../shared/variation.ts';
import { complete } from '../meta/client.ts';
import { MODELS } from '../meta/models.ts';

export interface AuditInput {
  config: SessionConfig;
  turns: Turn[];
  durationMs: number;
  hungUp: boolean;
  session: string;
  /** Framing facts from the optional camera (SAM 3.1). */
  camera?: { at: number; text: string }[];
}

/** Polish verbs carry gender, so the coach is told who the user is (or told to avoid gendered forms). */
function userNotePl(user: SessionConfig['user']): string {
  if (!user) return 'Nie znasz płci użytkownika: w podsumowaniu i w zdaniach betterLine unikaj czasu przeszłego w pierwszej i drugiej osobie, które wymaga rodzaju.';
  const f = user.gender === 'f';
  return `Użytkownik jest ${f ? 'kobietą' : 'mężczyzną'}. Zwracaj się do ${f ? 'niej' : 'niego'} na „ty”, w rodzaju ${f ? 'żeńskim' : 'męskim'}, a zdania betterLine pisz tak, jak ${f ? 'ona' : 'on'} by je powiedział${f ? 'a' : ''} (np. „${f ? 'sprawdziłam' : 'sprawdziłem'}”).`;
}

function systemPrompt(lang: Lang, winCondition: string, user: SessionConfig['user']): string {
  if (lang === 'pl') {
    return `Jesteś bystrym, uczciwym trenerem, który ocenia nagraną rozmowę treningową. Użytkownik ćwiczył ważną rozmowę z postacią AI. Widzisz prywatne myśli postaci, których użytkownik nie mógł usłyszeć.

Zasady:
- Bądź konkretny i szczery. Cytuj rzeczywiste słowa użytkownika. Nigdy nie wymyślaj rzeczy, które nie padły.
- Oceniaj względem prawdziwego celu: ${winCondition}
- Używaj prywatnych myśli i zmian nastroju postaci, żeby wyjaśnić DLACZEGO dany moment miał znaczenie („postać się rozkręcała do tury 4, a potem…”).
- Wybierz od 3 do 6 momentów, każdy powiązany z indeksem w transkrypcji. Przy każdym błędzie podaj konkretne "betterLine": zdanie, które użytkownik mógł powiedzieć własnym głosem, na tyle krótkie, żeby dało się je wypowiedzieć na głos. Przy mocnych stronach i punktach zwrotnych betterLine to pusty ciąg.
- Parametry wygłosu poniżej zostały zmierzone z nagrania; korzystaj z nich i nie zgaduj innych.
- Wynik: 0-100 ogółem; bądź skalibrowany (przyzwoita rozmowa to 55-70, znakomita 85+). outcome to "won" tylko wtedy, gdy cel został wyraźnie osiągnięty.
- weaknessTags: od 1 do 3 krótkich tagów małymi literami, na przykład „niejasno o cenie”, „zignorowane zastrzeżenie”, „przerywanie rozmówcy”, które posłużą do wycelowania następnej rozmowy.
- ${userNotePl(user)}
- Wszystkie teksty (verdict, summary, what, why, betterLine, nextFocus, weaknessTags) pisz po polsku. Pole verdict to jedno pełne zdanie werdyktu, a nie wartość pola outcome. Wartości pól wyliczeniowych (outcome: won/partial/lost, kind: strength/mistake/turning-point) zostaw dokładnie w oryginale.`;
  }
  return `You are a sharp, fair coach reviewing a recorded practice call. The user rehearsed a high-stakes conversation against an AI character. You can see the character's private thoughts, which the user could not.

Rules:
- Be specific and honest. Quote the user's actual words. Never invent things that were not said.
- Judge against the real goal: ${winCondition}
- Use the character's private thoughts and mood changes to explain WHY moments mattered ("the character was warming up until turn 4, then...").
- Pick 3 to 6 moments, each tied to a transcript index. For each mistake give a concrete "betterLine" the user could have said, in the user's voice, short enough to say aloud. For strengths and turning points betterLine is an empty string.
- The delivery numbers below were measured from the call; use them, do not guess others.
- Scores: 0-100 overall; be calibrated (a decent call is 55-70, excellent 85+). outcome is "won" only if the goal was clearly achieved.
- weaknessTags: 1 to 3 short lowercase tags such as "vague on price", "ignored objection", "talked over the other person", reused to aim the next call.`;
}

const LABEL = {
  en: { user: 'USER', mood: 'mood', thought: 'private thought', none: '(none)' },
  pl: { user: 'UŻYTKOWNIK', mood: 'nastrój', thought: 'prywatna myśl', none: '(brak)' },
} as const;

/**
 * The auditor sees what the user never could: the character's private thoughts and mood
 * on every turn, its hidden agenda, and delivery numbers measured from the call.
 */
export async function audit(input: AuditInput): Promise<AuditResult> {
  const { config, turns } = input;
  const lang = langOf(config);
  const L = LABEL[lang];
  const sc = scenarioDef(config.scenario, lang);
  const v = rollVariant(config.scenario, config.variant, lang);
  const delivery = measureDelivery(turns, input.durationMs, input.hungUp, lang);

  const transcript = turns
    .map((t, i) =>
      t.role === 'user'
        ? `[${i}] ${L.user} (${Math.round(t.at / 1000)}s): ${t.text}`
        : `[${i}] ${config.persona.name.toUpperCase()} (${Math.round(t.at / 1000)}s, ${L.mood} ${t.mood ?? 3}/5): ${t.text}\n      ${L.thought}: ${t.thought ?? L.none}`,
    )
    .join('\n');

  const cameraFacts = input.camera?.length
    ? input.camera.map((e) => `- ${Math.floor(e.at / 60000)}:${String(Math.floor(e.at / 1000) % 60).padStart(2, '0')} ${e.text}`).join('\n')
    : '';
  const cameraBlock = !cameraFacts
    ? ''
    : lang === 'pl'
      ? `\nFakty o kadrowaniu z kamery (wykrywanie twarzy SAM 3.1, z czasami w rozmowie):\n${cameraFacts}\nWspomnij o jednym z nich tylko tam, gdzie pasuje do momentu z transkrypcji. To fakty o kadrowaniu, nigdy dowód emocji ani cech osobowości: nie zgaduj, co użytkownik czuł.\n`
      : `\nCamera framing facts (from SAM 3.1 face detection, with times in the call):\n${cameraFacts}\nMention one only where it lines up with a transcript moment. These are framing facts, never evidence of emotion or personality: do not guess what the user felt.\n`;

  const user =
    lang === 'pl'
      ? `Scenariusz: ${sc.title}. Temat użytkownika: „${config.topic}”.
Postać: ${config.persona.name}, ${config.persona.role}. Sytuacja tego dnia: ${v.circumstance} Ukryty plan: ${v.agenda}
Poziom trudności: ${config.level} z 4.${input.hungUp ? '\nPostać rozłączyła się z użytkownikiem.' : ''}

Zmierzone parametry wygłosu: ${JSON.stringify(delivery)}
${cameraBlock}
Transkrypcja:
${transcript}`
      : `Scenario: ${sc.title}. The user's topic: "${config.topic}".
Character: ${config.persona.name}, ${config.persona.role}. Today's situation: ${v.circumstance} Hidden agenda: ${v.agenda}
Difficulty level: ${config.level} of 4.${input.hungUp ? '\nThe character hung up on the user.' : ''}

Measured delivery: ${JSON.stringify(delivery)}
${cameraBlock}
Transcript:
${transcript}`;

  const raw = await complete({
    model: MODELS.wonder,
    messages: [
      { role: 'system', content: systemPrompt(lang, sc.winCondition, config.user) },
      { role: 'user', content: user },
    ],
    kind: 'audit',
    session: input.session,
    maxTokens: 6000,
    effort: 'low',
    schema: AUDIT_SCHEMA,
  });
  const result = JSON.parse(raw) as AuditResult;
  result.moments = result.moments.filter((m) => m.turn >= 0 && m.turn < turns.length).sort((a, b) => a.turn - b.turn);
  return ensureVerdict(result);
}
