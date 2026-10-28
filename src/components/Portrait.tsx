import { useEffect, useState } from 'react';
import type { Mood, Persona, ScenarioId } from '../../shared/types.ts';

interface Portraits {
  neutral: string;
  cold: string;
  warm: string;
}

const MOOD_COLOR = ['', '#ef4444', '#f59e0b', '#9ca3af', '#84cc16', '#22c55e'];

/** Loads the three Muse Image portraits in the background so the call is never delayed. */
function usePortraits(session: string, scenario: ScenarioId, persona: Persona) {
  const [p, setP] = useState<Portraits | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/portraits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session, scenario, persona }),
    })
      .then((r) => (r.ok ? (r.json() as Promise<Portraits>) : null))
      .then((j) => live && j && setP(j))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [session, scenario, persona]);
  return p;
}

/**
 * The counterpart's face. Three expressions of the same person are cross-faded
 * according to their mood, with the initials shown until the images arrive.
 */
export function Portrait({ session, scenario, persona, mood, className = '' }: { session: string; scenario: ScenarioId; persona: Persona; mood: Mood; className?: string }) {
  const portraits = usePortraits(session, scenario, persona);
  const shown: keyof Portraits = mood <= 2 ? 'cold' : mood >= 4 ? 'warm' : 'neutral';
  const initials = persona.name
    .split(' ')
    .map((w) => w[0])
    .join('');

  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 bg-[var(--panel)] ${className}`} style={{ borderColor: MOOD_COLOR[mood], transition: 'border-color .6s' }}>
      {!portraits && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[var(--muted)]">
          <span className="text-3xl font-semibold">{initials}</span>
          <span className="text-[10px]">drawing portrait…</span>
        </div>
      )}
      {portraits &&
        (Object.keys(portraits) as (keyof Portraits)[]).map((k) => (
          <img
            key={k}
            src={portraits[k]}
            alt={k === shown ? `${persona.name}, ${k}` : ''}
            aria-hidden={k !== shown}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: k === shown ? 1 : 0, transition: 'opacity .7s ease' }}
          />
        ))}
    </div>
  );
}
