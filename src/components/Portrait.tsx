import { useEffect, useState } from 'react';
import type { Lang, Mood, Persona, ScenarioId } from '../../shared/types.ts';
import { t } from '../i18n/index.ts';
import { Archetype } from './Archetype.tsx';
import styles from './Portrait.module.css';

interface Portraits {
  neutral: string;
  cold: string;
  warm: string;
}

/** Loads the three Muse Image portraits in the background so the call is never delayed. */
function usePortraits(session: string, scenario: ScenarioId, persona: Persona, lang: Lang) {
  const [p, setP] = useState<Portraits | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/portraits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session, scenario, persona, lang }),
    })
      .then((r) => (r.ok ? (r.json() as Promise<Portraits>) : null))
      .then((j) => live && j && setP(j))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [session, scenario, persona, lang]);
  return p;
}

/**
 * The counterpart's face, filling whatever frame it is placed in. Three expressions of the same person are
 * cross-faded according to their mood; a blurred photograph of the same kind of person stands in until the images arrive.
 */
export function Portrait({ session, scenario, persona, mood, lang = 'en' }: { session: string; scenario: ScenarioId; persona: Persona; mood: Mood; lang?: Lang }) {
  const portraits = usePortraits(session, scenario, persona, lang);
  const shown: keyof Portraits = mood <= 2 ? 'cold' : mood >= 4 ? 'warm' : 'neutral';

  return (
    <div className={styles.portrait}>
      <Archetype scenario={scenario} blur />
      {!portraits && <span className={styles.wait}>{t('drawingPortrait')}</span>}
      {portraits &&
        (Object.keys(portraits) as (keyof Portraits)[]).map((k) => (
          <img
            key={k}
            src={portraits[k]}
            alt={k === shown ? `${persona.name}, ${k}` : ''}
            aria-hidden={k !== shown}
            className={styles.image}
            style={{ opacity: k === shown ? 1 : 0 }}
          />
        ))}
    </div>
  );
}
