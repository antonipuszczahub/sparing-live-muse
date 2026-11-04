import { useEffect, useState } from 'react';
import type { Lang } from '../../shared/types.ts';
import { t } from '../i18n/index.ts';
import { clearRuns, recentRuns, sparkline, type Run } from '../lib/history.ts';
import ui from './ui.module.css';
import styles from './Progress.module.css';

const W = 168;
const H = 48;

/** The scores of your last calls as a small line, so you can see whether rehearsing is working. Kept in this browser only. */
export function Progress({ lang }: { lang: Lang }) {
  const [runs, setRuns] = useState<Run[]>(() => recentRuns(lang));
  useEffect(() => setRuns(recentRuns(lang)), [lang]);
  if (!runs.length) return null;

  const scores = runs.map((r) => r.score);
  const last = scores[scores.length - 1]!;
  const best = Math.max(...scores);
  const points = sparkline(scores, W, H);
  const [lx, ly] = points.split(' ').pop()!.split(',');
  const change = scores.length > 1 ? last - scores[0]! : 0;

  return (
    <section className={styles.card} aria-label={t('progressTitle')}>
      <div className={styles.head}>
        <span className={ui.lbl}>{t('progressTitle')}</span>
        <button
          type="button"
          className={styles.clear}
          onClick={() => {
            clearRuns(lang);
            setRuns([]);
          }}
        >
          {t('progressClear')}
        </button>
      </div>
      <div className={styles.body}>
        {scores.length > 1 && (
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={styles.line} role="img" aria-label={scores.join(', ')}>
            <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={lx} cy={ly} r="4.5" fill="var(--brass-hi)" />
          </svg>
        )}
        <div className={styles.nums}>
          <b>{last}</b>
          <span>
            {t('progressBest', best)}
            {change !== 0 && ` · ${change > 0 ? '+' : '−'}${Math.abs(change)}`}
          </span>
        </div>
      </div>
    </section>
  );
}
