import ui from './ui.module.css';

const LEAF = 'M0 0 C 3 -5.5, 11 -7.5, 17 -5 C 15.5 1, 8 4.5, 0 0 Z';
const PETAL = 'M0 0 C 2.5 -4.5, 8 -6, 12.5 -3.6 C 11.5 1.2, 5.5 3.4, 0 0 Z';

/** One leaf or petal, grown from its base point at an angle; `d` is the delay in seconds. */
function Part({ path, x, y, a, fill, d, s = 1.3 }: { path: string; x: number; y: number; a: number; fill: string; d: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${a}) scale(${s})`}>
      <path className={ui.sprout} style={{ animationDelay: `${d}s` }} d={path} fill={fill} />
    </g>
  );
}

/** The S of the wordmark: a single stem bent into the letter, with leaves along it and a flower at the bend. */
function Glyph() {
  return (
    <svg className={ui.glyph} viewBox="0 0 60 90" aria-hidden="true">
      <path
        className={ui.tendril}
        pathLength={1}
        d="M12 87 C 26 77, 45 67, 46 55 C 47 44, 34 42, 25 36 C 15 30, 17 16, 31 12 C 39 10, 47 14, 47 23"
        fill="none"
        stroke="#cdb67e"
        strokeWidth="5.6"
        strokeLinecap="round"
      />
      <Part path={LEAF} x={13} y={85} a={-118} fill="#8fa27c" d={1.0} />
      <Part path={LEAF} x={46} y={55} a={-30} fill="#8fa27c" d={1.5} />
      <Part path={LEAF} x={47} y={22} a={-60} fill="#b9c8a5" d={2.1} />
      <Part path={PETAL} x={22} y={22} a={-160} fill="#9c3a4a" d={1.9} />
      <Part path={PETAL} x={22} y={22} a={-125} fill="#b24a5a" d={2.0} />
      <Part path={PETAL} x={22} y={22} a={-195} fill="#862f3f" d={2.05} />
    </svg>
  );
}

/** "Sparing Live" with the vine as its S. `size` is the height of the letters in pixels. */
export function Brand({ size = 38 }: { size?: number }) {
  return (
    <div className={ui.brand} role="img" aria-label="Sparing Live" style={{ fontSize: size * 0.8 }}>
      <span className={ui.wm} aria-hidden="true">
        <Glyph />
        <span>paring</span>
        <i>Live</i>
      </span>
    </div>
  );
}
