import type { Mood } from '../../shared/types.ts';
import { MOOD_COLOR } from '../lib/mood.ts';

/** Five leaves that fill with the mood, in the colour of the mood. */
export function LeafMeter({ mood, size = 22, label }: { mood: Mood; size?: number; label: string }) {
  return (
    <span role="img" aria-label={label} style={{ display: 'inline-flex', gap: 5 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
          <path
            d="M4 20 C 3 11, 9 4, 20 3 C 21 13, 15 20, 4 20 Z"
            style={{ fill: MOOD_COLOR[mood], opacity: i <= mood ? 1 : 0.2, transition: 'fill .8s, opacity .8s' }}
          />
          <path d="M4 20 L 15 8" stroke="#07100b" strokeOpacity=".4" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </svg>
      ))}
    </span>
  );
}
