import { useEffect, useRef } from 'react';
import { startVines, type VineProps } from '../lib/vines.ts';
import styles from './Vines.module.css';

const NARROW = 700;

/** One set of foliage for the whole app, kept sparse so it frames the content instead of competing with it; the zone keeps it off the content column, on phones as well. */
const read = (): VineProps => {
  const narrow = window.innerWidth < NARROW;
  return { seed: 11, density: narrow ? 0.45 : 0.6, avoid: narrow ? '0.05,0.05,0.95,0.97' : '0.07,0,0.93,1' };
};

export function Vines() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const handle = ref.current ? startVines(ref.current, read) : null;
    return () => handle?.stop();
  }, []);
  return <canvas ref={ref} className={styles.canvas} aria-hidden="true" />;
}
