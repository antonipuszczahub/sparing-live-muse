import type { ReactNode } from 'react';
import ui from './ui.module.css';
import styles from './Switch.module.css';

export function Switch({ checked, onChange, children }: { checked: boolean; onChange: (on: boolean) => void; children: ReactNode }) {
  return (
    <label className={styles.switch}>
      <input className={ui.sr} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.track}>
        <span className={styles.knob} />
      </span>
      <span>{children}</span>
    </label>
  );
}
