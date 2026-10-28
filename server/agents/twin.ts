import { z } from 'zod';
import { SCENARIOS } from '../../shared/scenarios.ts';
import type { ScenarioId, TwinProfile } from '../../shared/types.ts';
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

const JSON_SHAPE = `{
  "company": "official company name",
  "buyerRole": "job title of the person on the other side of the call",
  "buyerBio": "2 sentences about this fictional person: what they own, what they are measured on, how they react to pitches",
  "summary": "3 sentences: what the company does, size and stage, how it makes money",
  "customers": "who the company's own customers are",
  "pains": ["3 to 5 specific problems the company currently has, visible in public sources"],
  "objections": ["3 to 5 objections this counterpart would REALLY raise to the user's pitch, phrased as they would say it"],
  "vocabulary": ["6 to 10 words or phrases this company actually uses on its site and in its docs"]
}`;

const BRIEF: Record<ScenarioId, string> = {
  sales: 'The user will cold-call this company to sell: "{topic}". The counterpart is the person who would decide or influence the purchase.',
  defense: 'The user will defend: "{topic}" in front of an examiner connected to this organisation. The counterpart is an examiner there.',
  salary: 'The user works at (or is joining) this company and will negotiate pay: "{topic}". The counterpart is their manager. Focus on the company situation: growth, funding, layoffs, how it pays and what it values.',
  pitch: 'The user will pitch an investor at this fund/firm: "{topic}". The counterpart is a partner. Focus on the thesis, stage, check size, portfolio and what they have passed on.',
};

export interface TwinInput {
  company: string;
  scenario: ScenarioId;
  topic: string;
  session: string;
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
  const sc = SCENARIOS[input.scenario];
  const prompt = `You prepare a realistic practice partner for a high-stakes conversation. Research the company below with web search (use several searches and open its own site), then describe it.

Company or website: ${input.company}
Scenario: ${sc.title}. ${BRIEF[input.scenario].replace('{topic}', input.topic)}

Rules:
- Use only what you actually found. If something is unknown, say so briefly instead of inventing it.
- The counterpart is a fictional person in a role at this company. Never name or describe a real employee.
- Pains and objections must be specific to THIS company (their product, market, size, recent news), not generic.
- Work quickly: 3 to 6 searches are enough.
- Your final message must contain ONLY this JSON object, no commentary:
${JSON_SHAPE}`;

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
    onStep({ kind: 'note', text: 'Structuring the findings…' });
    const fixed = await complete({
      model: MODELS.spark,
      kind: 'twin-format',
      session: input.session,
      maxTokens: 2500,
      effort: 'minimal',
      messages: [
        { role: 'system', content: `Convert the research notes into exactly this JSON shape, filling only from the notes:\n${JSON_SHAPE}` },
        { role: 'user', content: res.text || 'No notes.' },
      ],
    });
    parsed = TwinSchema.parse(extractJson(fixed));
  }

  const url = /^https?:\/\//.test(input.company) ? input.company : res.sources[0]?.url ?? '';
  return { ...parsed, url, sources: res.sources.slice(0, 8).map((s) => s.url) };
}
