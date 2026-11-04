import { useEffect, useState } from 'react';
import type { Lang, Mood, Persona, ScenarioId } from '../../shared/types.ts';
import { t } from '../i18n/index.ts';
import { Archetype } from './Archetype.tsx';
import styles from './Portrait.module.css';

type Face = 'neutral' | 'cold' | 'warm';
type Faces = Partial<Record<Face, string>>;

/**
 * Loads the three Muse Image portraits in the background so the call is never delayed. The neutral portrait comes
 * first (the server answers as soon as it is drawn); the cold and warm expressions follow, edited from it.
 */
function usePortraits(session: string, scenario: ScenarioId, persona: Persona, lang: Lang, still: boolean): Faces {
  const [faces, setFaces] = useState<Faces>({});
  useEffect(() => {
    if (still) return; // the sample call makes no model calls: the photograph of the archetype stays
    let live = true;
    setFaces({});
    const ask = (part: 'neutral' | 'rest') =>
      fetch('/api/portraits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, scenario, persona, lang, part }),
      })
        .then((r) => (r.ok ? (r.json() as Promise<Faces>) : null))
        .then((j) => live && j && setFaces((prev) => ({ ...prev, ...j })))
        .catch(() => undefined);
    void ask('neutral');
    void ask('rest');
    return () => {
      live = false;
    };
  }, [session, scenario, persona, lang, still]);
  return faces;
}

/**
 * The counterpart's face, filling whatever frame it is placed in. Three expressions of the same person are
 * cross-faded according to their mood (the neutral one stands in while the others are still being drawn); a blurred
 * photograph of the same kind of person stands in until the first portrait arrives.
 */
export function Portrait({
  session,
  scenario,
  persona,
  mood,
  lang = 'en',
  speaking = false,
  still = false,
}: {
  session: string;
  scenario: ScenarioId;
  persona: Persona;
  mood: Mood;
  lang?: Lang;
  /** The character is talking: the face moves a little faster and nods slightly, instead of only breathing. */
  speaking?: boolean;
  /** Draw nothing: show the archetype photograph only (the sample call). */
  still?: boolean;
}) {
  const faces = usePortraits(session, scenario, persona, lang, still);
  const wanted: Face = mood <= 2 ? 'cold' : mood >= 4 ? 'warm' : 'neutral';
  const shown: Face = faces[wanted] ? wanted : 'neutral';

  return (
    <div className={`${styles.portrait} ${speaking ? styles.talking : ''}`}>
      <Archetype scenario={scenario} blur={!still} />
      {!still && !faces.neutral && <span className={styles.wait}>{t('drawingPortrait')}</span>}
      {(Object.keys(faces) as Face[]).map((k) => (
        <img
          key={k}
          src={faces[k]}
          alt={k === shown ? `${persona.name}, ${k}` : ''}
          aria-hidden={k !== shown}
          className={styles.image}
          style={{ opacity: k === shown ? 1 : 0 }}
        />
      ))}
    </div>
  );
}
