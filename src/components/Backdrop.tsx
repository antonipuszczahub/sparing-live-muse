import { Vines } from './Vines.tsx';
import styles from './Backdrop.module.css';

/** Everything behind the screens: the tinted glow, drifting light, the vines and a little film grain. */
export function Backdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.glow} />
      <div className={`${styles.shaft} ${styles.a}`} />
      <div className={`${styles.shaft} ${styles.b}`} />
      <Vines />
      <svg className={styles.grain}>
        <filter id="sl-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#sl-grain)" />
      </svg>
    </div>
  );
}
