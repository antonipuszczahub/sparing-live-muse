import { S_BOX, S_PATH, S_STROKE } from '../lib/logo.ts';
import ui from './ui.module.css';

/**
 * The mark is the first letter of the name: a fast S with soft edges in flat orange, no gradient.
 * It draws itself once when the page opens.
 * (The same shape on a flat black square is the app icon.)
 */
function Mark() {
  return (
    <svg className={ui.mark} viewBox={`${S_BOX.x} ${S_BOX.y} ${S_BOX.w} ${S_BOX.h}`} aria-hidden="true">
      <path className={ui.arcs} pathLength={1} d={S_PATH} fill="none" stroke="currentColor" strokeWidth={S_STROKE} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** "Sparing Live" where the mark is the S: it stands on the baseline like a letter. `size` is the logo's height in pixels. */
export function Brand({ size = 38 }: { size?: number }) {
  return (
    <div className={ui.brand} role="img" aria-label="Sparing Live" style={{ fontSize: size * 0.64 }}>
      <Mark />
      <span className={ui.wm} aria-hidden="true">
        <span>paring</span>
        <i>Live</i>
      </span>
    </div>
  );
}
