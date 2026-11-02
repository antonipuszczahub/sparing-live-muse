import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../i18n/index.ts';
import { Icon } from './Icons.tsx';
import ui from './ui.module.css';
import styles from './Sheet.module.css';

/** A panel that slides over the screen, for the things that should not crowd it. Escape and a click outside close it. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={`${styles.panel} ${ui.glass}`}>
        <header className={styles.head}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('close')}>
            <Icon name="close" size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
