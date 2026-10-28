import { SCENARIOS } from '../../shared/scenarios.ts';
import { AUDIT_SCHEMA, measureDelivery, type AuditResult } from '../../shared/audit.ts';
import type { SessionConfig, Turn } from '../../shared/types.ts';
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

/**
 * The auditor sees what the user never could: the character's private thoughts and mood
 * on every turn, its hidden agenda, and delivery numbers measured from the call.
 */
export async function audit(input: AuditInput): Promise<AuditResult> {
  const { config, turns } = input;
  const sc = SCENARIOS[config.scenario];
  const v = rollVariant(config.scenario, config.variant);
  const delivery = measureDelivery(turns, input.durationMs, input.hungUp);

  const transcript = turns
    .map((t, i) =>
      t.role === 'user'
        ? `[${i}] USER (${Math.round(t.at / 1000)}s): ${t.text}`
        : `[${i}] ${config.persona.name.toUpperCase()} (${Math.round(t.at / 1000)}s, mood ${t.mood ?? 3}/5): ${t.text}\n      private thought: ${t.thought ?? '(none)'}`,
    )
    .join('\n');

  const system = `You are a sharp, fair coach reviewing a recorded practice call. The user rehearsed a high-stakes conversation against an AI character. You can see the character's private thoughts, which the user could not.

Rules:
- Be specific and honest. Quote the user's actual words. Never invent things that were not said.
- Judge against the real goal: ${sc.winCondition}
- Use the character's private thoughts and mood changes to explain WHY moments mattered ("the character was warming up until turn 4, then...").
- Pick 3 to 6 moments, each tied to a transcript index. For each mistake give a concrete "betterLine" the user could have said, in the user's voice, short enough to say aloud. For strengths and turning points betterLine is an empty string.
- The delivery numbers below were measured from the call; use them, do not guess others.
- Scores: 0-100 overall; be calibrated (a decent call is 55-70, excellent 85+). outcome is "won" only if the goal was clearly achieved.
- weaknessTags: 1 to 3 short lowercase tags such as "vague on price", "ignored objection", "talked over the other person", reused to aim the next call.`;

  const user = `Scenario: ${sc.title}. The user's topic: "${config.topic}".
Character: ${config.persona.name}, ${config.persona.role}. Today's situation: ${v.circumstance} Hidden agenda: ${v.agenda}
Difficulty level: ${config.level} of 4.${input.hungUp ? '\nThe character hung up on the user.' : ''}

Measured delivery: ${JSON.stringify(delivery)}
${
  input.camera?.length
    ? `\nCamera framing facts (from SAM 3.1 face detection, with times in the call):\n${input.camera
        .map((e) => `- ${Math.floor(e.at / 60000)}:${String(Math.floor(e.at / 1000) % 60).padStart(2, '0')} ${e.text}`)
        .join('\n')}\nMention one only where it lines up with a transcript moment. These are framing facts, never evidence of emotion or personality: do not guess what the user felt.\n`
    : ''
}
Transcript:
${transcript}`;

  const raw = await complete({
    model: MODELS.wonder,
    messages: [
      { role: 'system', content: system },
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
  return result;
}
