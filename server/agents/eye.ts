import { SCENARIOS } from '../../shared/scenarios.ts';
import type { ScenarioId } from '../../shared/types.ts';
import { complete } from '../meta/client.ts';
import { MODELS } from '../meta/models.ts';

export interface EyeInput {
  /** data:image/jpeg;base64,... of the user's shared screen. */
  image: string;
  scenario: ScenarioId;
  topic: string;
  session: string;
  signal?: AbortSignal;
}

/**
 * The eye agent looks at the user's shared screen (slides, code, a portfolio site) and writes
 * the notes a sharp counterpart would take. The character reads these notes as if it could see.
 */
export async function look(input: EyeInput): Promise<string> {
  const sc = SCENARIOS[input.scenario];
  const text = await complete({
    model: MODELS.spark,
    kind: 'eye',
    session: input.session,
    maxTokens: 900,
    effort: 'minimal',
    signal: input.signal,
    messages: [
      {
        role: 'system',
        content: `You are the eyes of someone sitting across from the user on a ${sc.title.toLowerCase()} call. The user (topic: "${input.topic}") is sharing their screen. Write the notes this person would jot down. Rules:
- Say what it is first (slide, code file, website, document, spreadsheet, something else) and which one if numbered.
- Copy visible text exactly: titles, headline numbers, labels, and up to 12 lines of code verbatim with their line numbers when shown. Never invent text you cannot read.
- Then list up to 3 things a sharp, skeptical counterpart would pounce on: missing evidence, unclear numbers, typos, risky code, weak claims.
- Under 170 words, plain text, no markdown, do not address the user.`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Here is the shared screen right now.' },
          { type: 'image_url', image_url: { url: input.image } },
        ],
      },
    ],
  });
  return text.trim();
}
