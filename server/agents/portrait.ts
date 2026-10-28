import type { Persona, ScenarioId } from '../../shared/types.ts';
import { ledger } from '../meta/ledger.ts';
import { BudgetError } from '../meta/client.ts';
import { FLAT_PRICES, MODELS } from '../meta/models.ts';

export interface Portraits {
  neutral: string;
  cold: string;
  warm: string;
}

const base = () => process.env.META_BASE_URL || 'https://api.meta.ai/v1';

async function post(path: string, body: unknown, session: string, kind: string): Promise<string> {
  const g = ledger.canSpend(session);
  if (!g.ok) throw new BudgetError(g.reason);
  const t0 = Date.now();
  const res = await fetch(`${base()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.MODEL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Image API ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = (await res.json()) as { output_format?: string; data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('Image API returned no image');
  ledger.record({ kind, model: MODELS.image, session, costUsd: FLAT_PRICES.imagePerImage, totalMs: Date.now() - t0 });
  return `data:image/${json.output_format ?? 'webp'};base64,${b64}`;
}

const SETTING: Record<ScenarioId, string> = {
  sales: 'in their own small office, softly blurred background',
  defense: 'in a university seminar room, softly blurred background',
  salary: 'in a quiet meeting room, softly blurred background',
  pitch: 'in a modern investor office, softly blurred background',
};

/**
 * Muse Image draws the counterpart once, then edits the same face into three expressions
 * so the portrait follows the character's mood during the call. 3 images, about 3 cents.
 */
export async function drawPortraits(input: { persona: Persona; scenario: ScenarioId; mood: string; session: string }): Promise<Portraits> {
  const { persona, scenario, session } = input;
  const who = persona.gender === 'f' ? 'woman' : 'man';
  const neutral = await post(
    '/images/generations',
    {
      model: MODELS.image,
      n: 1,
      size: '1024x1024',
      output_format: 'webp',
      prompt: `Realistic head-and-shoulders photo of a fictional ${who}, around 45 years old, who is a ${persona.role}, ${SETTING[scenario]}. Natural light, neutral businesslike expression, looking at the camera like on a video call. Photographic, no text, no logos.`,
    },
    session,
    'portrait',
  );
  const edit = (expression: string) =>
    post(
      '/images/edits',
      {
        model: MODELS.image,
        images: [{ image_url: neutral }],
        prompt: `Same person, same clothes, same framing and background. Only change the facial expression to: ${expression}.`,
      },
      session,
      'portrait-edit',
    );
  const [cold, warm] = await Promise.all([
    edit('cold and unimpressed, arms of the face tense, eyebrows slightly furrowed, mouth flat'),
    edit('warm and interested, a genuine small smile, relaxed eyebrows'),
  ]);
  return { neutral, cold, warm };
}
