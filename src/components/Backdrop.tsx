import { useEffect, useRef } from 'react';
import styles from './Backdrop.module.css';

const PULSE = 'sl-pulse';

/** A short flare of light behind a change of screen. */
export const pulseBackdrop = () => window.dispatchEvent(new Event(PULSE));

/**
 * Everything behind the screens: paper that turns to orange, three pools of light that drift on their own and lean
 * towards the pointer, and a little film grain. The call tints the light with the character's mood (--mc).
 */
export function Backdrop() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    const move = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const frame = () => {
      x += (tx - x) * 0.04;
      y += (ty - y) * 0.04;
      el.style.setProperty('--px', x.toFixed(3));
      el.style.setProperty('--py', y.toFixed(3));
      raf = requestAnimationFrame(frame);
    };
    let flare = 0;
    const pulse = () => {
      el.dataset.pulse = 'on';
      window.clearTimeout(flare);
      flare = window.setTimeout(() => delete el.dataset.pulse, 900);
    };
    window.addEventListener(PULSE, pulse);
    if (!calm) {
      window.addEventListener('pointermove', move, { passive: true });
      raf = requestAnimationFrame(frame);
    }
    return () => {
      window.removeEventListener(PULSE, pulse);
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(raf);
      window.clearTimeout(flare);
    };
  }, []);

  return (
    <div ref={root} className={styles.backdrop} aria-hidden="true">
      <div className={`${styles.orb} ${styles.o1}`} />
      <div className={`${styles.orb} ${styles.o2}`} />
      <div className={`${styles.orb} ${styles.o3}`} />
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
