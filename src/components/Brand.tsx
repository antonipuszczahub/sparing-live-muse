import ui from './ui.module.css';

/**
 * The mark: an S built from two arcs, one voice on each side of the conversation, on an orange tile.
 * It draws itself once when the page opens.
 */
function Mark() {
  return (
    <span className={ui.tile} aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <path className={ui.arcs} pathLength={1} d="M33 15 A9 9 0 1 0 24 24 A9 9 0 1 1 15 33" fill="none" stroke="#fff" strokeWidth="7.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** "Sparing Live" with its mark. `size` is the height of the tile in pixels. */
export function Brand({ size = 38 }: { size?: number }) {
  return (
    <div className={ui.brand} role="img" aria-label="Sparing Live" style={{ fontSize: size * 0.58 }}>
      <Mark />
      <span className={ui.wm} aria-hidden="true">
        <span>Sparing</span>
        <i>Live</i>
      </span>
    </div>
  );
}
