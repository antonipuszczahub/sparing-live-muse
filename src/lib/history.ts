import type { Lang, Level, ScenarioId } from '../../shared/types.ts';

/**
 * The scores of the calls you have finished, kept in this browser only (like the weak spots), so the start screen can
 * show whether the rehearsing is working. Nothing about what was said is stored: just when, which scenario, the score.
 */
export interface Run {
  t: number;
  score: number;
  scenario: ScenarioId;
  level: Level;
}

const key = (lang: Lang) => (lang === 'en' ? 'sl.runs.v1' : `sl.runs.v1.${lang}`);
const KEEP = 30;

export function loadRuns(lang: Lang): Run[] {
  try {
    const all = JSON.parse(localStorage.getItem(key(lang)) ?? '[]') as Run[];
    return Array.isArray(all) ? all.filter((r) => Number.isFinite(r?.score) && Number.isFinite(r?.t)) : [];
  } catch {
    return [];
  }
}

export function recordRun(run: Run, lang: Lang) {
  try {
    const next = [...loadRuns(lang), { ...run, score: Math.max(0, Math.min(100, Math.round(run.score))) }].slice(-KEEP);
    localStorage.setItem(key(lang), JSON.stringify(next));
  } catch {
    /* private mode: the app works without a history */
  }
}

export function clearRuns(lang: Lang) {
  try {
    localStorage.removeItem(key(lang));
  } catch {
    /* nothing to clear */
  }
}

/** The last `n` runs, oldest first. */
export const recentRuns = (lang: Lang, n = 8): Run[] => loadRuns(lang).slice(-n);

/**
 * The points of a sparkline for scores of 0 to 100, as an SVG polyline string, oldest on the left. The vertical range
 * follows the scores (with a little room), so a climb from 38 to 63 is visible instead of a flat line.
 */
export function sparkline(scores: number[], width: number, height: number, pad = 4): string {
  if (!scores.length) return '';
  let lo = Math.max(0, Math.min(...scores) - 8);
  let hi = Math.min(100, Math.max(...scores) + 8);
  if (hi - lo < 24) {
    const mid = (hi + lo) / 2;
    lo = Math.max(0, mid - 12);
    hi = Math.min(100, lo + 24);
  }
  const x = (i: number) => (scores.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (scores.length - 1));
  const y = (v: number) => height - pad - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (height - 2 * pad);
  return scores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
}
