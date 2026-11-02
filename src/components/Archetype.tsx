import type { CSSProperties } from 'react';
import type { ScenarioId } from '../../shared/types.ts';

/**
 * A photograph of the kind of person each scenario calls (made once by `npm run make:archetypes`, shipped as static files).
 * It stands in for the real face on the start screen and while the call's own portrait is being drawn.
 */
export function Archetype({ scenario, blur = false }: { scenario: ScenarioId; blur?: boolean }) {
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
  return <img src={`/archetypes/${scenario}.webp`} alt="" aria-hidden="true" decoding="async" style={style} />;
}
