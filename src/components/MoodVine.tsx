import type { Mood } from '../../shared/types.ts';
import type { MoodVineLayout } from '../lib/moodVine.ts';
import { KIND_COLOR, MOOD_COLOR } from '../lib/mood.ts';
import styles from './MoodVine.module.css';

const LEAF = 'M0 0 C -7 -5 -9 -17 0 -26 C 9 -17 7 -5 0 0 Z';

/** The character's mood over the call, drawn as a vine with a leaf per turn. Points and flags jump to the replay. */
export function MoodVine({
  layout,
  moodName,
  time,
  label,
  onPick,
}: {
  layout: MoodVineLayout;
  moodName: (mood: Mood) => string;
  time: (ms: number) => string;
  label: string;
  onPick: (turn: number) => void;
}) {
  const { vertical, width, height } = layout;
  const pick = (turn: number) => (e: { key: string; preventDefault: () => void }) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick(turn);
    }
  };
  // vertical charts only have room for the two ends and the middle
  const named = layout.guides.filter((g) => !vertical || g.mood % 2 === 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.chart} role="group" aria-label={label}>
      <g stroke="rgba(27,19,13,.08)" strokeWidth="1">
        {layout.guides.map((g) => (vertical ? <path key={g.mood} d={`M${g.pos} 28 V${height - 28}`} /> : <path key={g.mood} d={`M96 ${g.pos} H${width}`} />))}
      </g>
      <g className={styles.axis}>
        {named.map((g) =>
          vertical ? (
            <text key={g.mood} x={g.pos} y="16" textAnchor="middle">
              {moodName(g.mood)}
            </text>
          ) : (
            <text key={g.mood} x="0" y={g.pos + 4}>
              {moodName(g.mood)}
            </text>
          ),
        )}
      </g>
      <path d={layout.path} fill="none" stroke="#fff3e4" strokeWidth="9" strokeLinecap="round" />
      <path d={layout.path} fill="none" stroke="#c2410c" strokeWidth="3.2" strokeLinecap="round" className={styles.grow} pathLength={1} />
      {layout.flags.map((f) => (
        <g key={f.turn} className={styles.flag} role="button" tabIndex={0} aria-label={f.letter} onClick={() => onPick(f.turn)} onKeyDown={pick(f.turn)}>
          <path d={vertical ? `M${f.from} ${f.y} H${f.to}` : `M${f.x} ${f.to} V${f.from}`} stroke={KIND_COLOR[f.kind]} strokeWidth="1.5" strokeDasharray="3 5" />
          <circle cx={f.x} cy={f.y} r="13" fill={KIND_COLOR[f.kind]} />
          <text x={f.x} y={f.y + 4.5} textAnchor="middle" className={styles.letter}>
            {f.letter}
          </text>
        </g>
      ))}
      {layout.nodes.map((n) => (
        <g key={n.turn} className={styles.node} role="button" tabIndex={0} aria-label={`${time(n.at)}, ${moodName(n.mood)}`} onClick={() => onPick(n.turn)} onKeyDown={pick(n.turn)}>
          <circle cx={n.x} cy={n.y} r="14" fill="transparent" />
          <circle cx={n.x} cy={n.y} r="6" fill="#fffaf3" stroke={MOOD_COLOR[n.mood]} strokeWidth="3" />
          <path transform={`translate(${n.leafX} ${n.leafY}) rotate(${n.rot})`} d={LEAF} fill={MOOD_COLOR[n.mood]} />
          {n.showTime && (
            <text className={styles.time} x={vertical ? 6 : n.x} y={vertical ? n.y + 4 : height - 8} textAnchor={vertical ? 'start' : 'middle'}>
              {time(n.at)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
