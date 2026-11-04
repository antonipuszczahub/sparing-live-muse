import type { CSSProperties } from 'react';
import type { ScenarioId } from '../../shared/types.ts';
import { archetypeFor } from '../lib/archetype.ts';

/**
 * A photograph of the kind of person each scenario calls (made once by `npm run make:archetypes`, shipped as static files).
 * It stands in for the real face on the start screen and while the call's own portrait is being drawn. Given the
 * character's gender it shows a person of that gender, and `src` replaces it with the call's own portrait.
 */
export function Archetype({ scenario, gender, src, blur = false }: { scenario: ScenarioId; gender?: 'm' | 'f'; src?: string; blur?: boolean }) {
  const style: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: '50% 24%',
    display: 'block',
    ...(blur ? { filter: 'blur(16px) saturate(0.85)', transform: 'scale(1.12)' } : null),
  };
  return <img src={src ?? `/archetypes/${archetypeFor(scenario, gender)}.webp`} alt="" aria-hidden="true" decoding="async" style={style} />;
}
