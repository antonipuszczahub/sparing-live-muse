import { useLang } from '../i18n/index.ts';
import { ABOUT } from '../i18n/about.ts';
import { Sheet } from './Sheet.tsx';
import ui from './ui.module.css';
import styles from './AboutSheet.module.css';

/**
 * Behind the Demo button: what the project is, what to watch for, what it runs on and where it is going, with a
 * button that fills in the demo call. The plans are marked as plans.
 */
export function AboutSheet({ open, onClose, onStartDemo, onSample }: { open: boolean; onClose: () => void; onStartDemo: () => void; onSample: () => void }) {
  const a = ABOUT[useLang()];
  return (
    <Sheet open={open} title={a.title} onClose={onClose}>
      <div className={styles.body}>
        <p className={styles.lead}>{a.lead}</p>

        <section>
          <h3 className={ui.lbl}>{a.watchTitle}</h3>
          <ol className={styles.steps}>
            {a.watch.map((w, i) => (
              <li key={w.title} className={styles.step}>
                <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <b>{w.title}</b>
                  <span className={styles.text}>{w.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className={ui.lbl}>{a.builtTitle}</h3>
          <p className={styles.text}>{a.built}</p>
        </section>

        <section>
          <h3 className={ui.lbl}>
            {a.nextTitle}
            <span className={styles.badge}>{a.nextNote}</span>
          </h3>
          <ul className={styles.next}>
            {a.next.map((n) => (
              <li key={n.title}>
                <b>{n.title}</b>
                <span className={styles.text}>{n.body}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.foot}>
          <button type="button" className={styles.cta} onClick={onStartDemo}>
            {a.start}
          </button>
          <p className={styles.note}>{a.startNote}</p>
          <button type="button" className={styles.ghost} onClick={onSample}>
            {a.sample}
          </button>
          <p className={styles.note}>{a.sampleNote}</p>
        </div>
      </div>
    </Sheet>
  );
}
