import type { ScenarioId } from '../../shared/types.ts';

/** Who is in each scenario's photograph (`npm run make:archetypes`, see WHO in scripts/make-archetypes.ts). */
export const ARCHETYPE_GENDER: Record<ScenarioId, 'm' | 'f'> = { sales: 'm', defense: 'f', salary: 'm', pitch: 'f' };

/**
 * The photograph that stands in for a character's face (while the real portrait is drawn, or when it cannot be): the
 * scenario's own when its person is the same gender as the character, otherwise another scenario's photograph of a
 * person of that gender, so "Ilona" in a sales call is never shown as the man of the sales photograph.
 */
export function archetypeFor(scenario: ScenarioId, gender?: 'm' | 'f'): ScenarioId {
  if (!gender || ARCHETYPE_GENDER[scenario] === gender) return scenario;
  return (Object.keys(ARCHETYPE_GENDER) as ScenarioId[]).find((id) => ARCHETYPE_GENDER[id] === gender) ?? scenario;
}
