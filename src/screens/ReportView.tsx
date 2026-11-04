import { useRef, useState } from 'react';
import { reviewAsText } from '../lib/reviewText.ts';
import { measureDelivery, type AuditResult, type Moment } from '../../shared/audit.ts';
import type { FramingEvent } from '../../shared/framing.ts';
import type { TraceRow } from '../../shared/trace.ts';
import { langOf } from '../../shared/lang.ts';
import type { Mood, SessionConfig, Turn } from '../../shared/types.ts';
import { Brand } from '../components/Brand.tsx';
import { ClipMaker } from '../components/ClipMaker.tsx';
import { Icon } from '../components/Icons.tsx';
import { MoodVine } from '../components/MoodVine.tsx';
import { Switch } from '../components/Switch.tsx';
import ui from '../components/ui.module.css';
import { moodLabel, t } from '../i18n/index.ts';
import { vars } from '../lib/css.ts';
import { KIND_COLOR, MOOD_COLOR, OUTCOME_COLOR } from '../lib/mood.ts';
import { layoutMoodVine, momentLetters, type MoodNode } from '../lib/moodVine.ts';
import { useMedia } from '../lib/useMedia.ts';
import { useMoodTheme } from '../lib/useMoodTheme.ts';
import s from './Report.module.css';

const kindLabel = (k: Moment['kind']) => t(k === 'strength' ? 'kindStrength' : k === 'mistake' ? 'kindMistake' : 'kindTurning');
const outcomeLabel = (o: AuditResult['outcome']) => t(o === 'won' ? 'outcomeWon' : o === 'partial' ? 'outcomePartial' : 'outcomeLost');
const SKILLS = {
  clarity: 'skillClarity',
  listening: 'skillListening',
  objections: 'skillObjections',
  specificity: 'skillSpecificity',
  composure: 'skillComposure',
} as const satisfies Record<keyof AuditResult['skills'], string>;

/** How the review tints the background: a won call is bright, a lost one is cold. */
const OUTCOME_MOOD = { won: 4, partial: 3, lost: 2 } as const satisfies Record<AuditResult['outcome'], Mood>;

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const unit = (n: number) => t('words', n).replace(/^\d+\s*/, '');

export interface ReportViewProps {
  session: string;
  config: SessionConfig;
  turns: Turn[];
  durationMs: number;
  hungUp: boolean;
  camera: FramingEvent[];
  /** Null while the review is being written. */
  result: AuditResult | null;
  /** Which models ran the call, from the budget ledger; empty or missing when it is not known. */
  trace?: TraceRow[];
  error: string;
  /** Seconds the review has been running, for the wait message. */
  secs: number;
  onAgain: () => void;
  onRedial: () => void;
  /** The review failed: ask for it again (the call itself is kept). */
  onRetry: () => void;
  /** A recorded call: the clip maker (which draws portraits with Muse Image) is not offered. */
  sample?: boolean;
}

/** The review: score, the mood vine, the numbers, and the replay with what the character was thinking. */
export function ReportView({ session, config, turns, durationMs, hungUp, camera, result, trace, error, secs, onAgain, onRedial, onRetry, sample }: ReportViewProps) {
  const lang = langOf(config);
  const persona = config.persona;
  const first = persona.name.split(' ')[0]!;
  const [mind, setMind] = useState(true);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const narrow = useMedia('(max-width: 700px)');
  const metrics = measureDelivery(turns, durationMs, hungUp, lang);

  useMoodTheme(result ? OUTCOME_MOOD[result.outcome] : 3, result ? OUTCOME_COLOR[result.outcome] : undefined);

  // One card per turn: when the review marks a turn twice, the later note wins, here and on the chart alike.
  const momentByTurn = new Map(result?.moments.map((m) => [m.turn, m]));
  const moments = [...momentByTurn.values()];
  const letters = momentLetters(moments);
  const nodes: MoodNode[] = turns.flatMap((x, i) => (x.role === 'bot' && x.mood ? [{ turn: i, mood: x.mood, at: x.at }] : []));
  const layout = layoutMoodVine(nodes, moments, narrow);
  const jump = (i: number) => rows.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const [copied, setCopied] = useState(false);
  const [fullSummary, setFullSummary] = useState(false);
  const long = (result?.summary.length ?? 0) > 340; // about five lines: the rest sits behind a button
  function copyReview() {
    if (!result) return;
    const text = reviewAsText({
      who: persona.name,
      durationMs,
      result,
      turns,
      labels: {
        review: t('reviewTitle'),
        outcome: outcomeLabel(result.outcome),
        skills: t('skillsTitle'),
        skillNames: { clarity: t('skillClarity'), listening: t('skillListening'), objections: t('skillObjections'), specificity: t('skillSpecificity'), composure: t('skillComposure') },
        moments: t('reviewMoments'),
        kinds: { strength: t('kindStrength'), mistake: t('kindMistake'), 'turning-point': t('kindTurning') },
        sayInstead: t('sayInstead'),
        workNext: t('workNext'),
        wording: t('wordingTitle'),
        wordingSaid: t('wordingSaid'),
        wordingBetter: t('wordingBetter'),
      },
    });
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  }

  return (
    <main className={s.page}>
      <header className={`${s.top} ${ui.rise1}`}>
        <Brand size={32} />
        <div className={s.topActions}>
          {result && (
            <button type="button" className={ui.btn} onClick={copyReview}>
              {copied ? t('copied') : t('copyReview')}
            </button>
          )}
          <button type="button" className={ui.btn} onClick={onRedial}>
            {t('redial', persona.name.split(' ')[0]!)}
          </button>
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={onAgain}>
            {t('newCall')}
            <Icon name="arrow" size={18} stroke={2} />
          </button>
        </div>
      </header>

      <section className={`${s.hero} ${ui.rise2}`}>
        <div>
          <span className={ui.lbl}>
            {t('reviewTitle')} · {t('reviewMeta', persona.name, fmt(durationMs), metrics.userTurns, hungUp, persona.gender)}
          </span>
          {result ? (
            <>
              <div className={s.score}>
                <span className={s.scoreNum}>{result.score}</span>
                <span className={s.outcome} style={vars({ '--c': OUTCOME_COLOR[result.outcome] })}>
                  <b />
                  {outcomeLabel(result.outcome)}
                </span>
              </div>
              <h1 className={s.verdict}>{result.verdict}</h1>
              <p className={`${s.sum} ${long && !fullSummary ? s.sumClamp : ''}`}>{result.summary}</p>
              {long && (
                <button type="button" className={s.more} onClick={() => setFullSummary(!fullSummary)} aria-expanded={fullSummary}>
                  {fullSummary ? t('summaryLess') : t('summaryMore')}
                </button>
              )}
            </>
          ) : error ? (
            <>
              <p className={`${ui.note} ${ui.noteBad}`} style={{ marginTop: 18 }}>
                {error}
              </p>
              <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} style={{ marginTop: 14 }} onClick={onRetry}>
                {t('retryReview')}
              </button>
            </>
          ) : (
            <div className={s.reviewing}>
              <svg viewBox="0 0 180 48" aria-hidden="true">
                <path pathLength={1} d="M4 38 C 30 6, 52 44, 80 22 S 130 6, 172 16" fill="none" stroke="#c2410c" strokeWidth="3.4" strokeLinecap="round" />
              </svg>
              <b>{t('reviewing', secs)}</b>
              <p>{t('reviewingNote', first)}</p>
            </div>
          )}
        </div>

        <div className={`${s.chart} ${ui.glass} ${ui.rise3}`}>
          <span className={ui.lbl}>{t('attitude')}</span>
          {layout ? (
            <MoodVine layout={layout} label={t('attitude')} moodName={(m) => moodLabel(m, lang, persona.gender)} time={fmt} onPick={jump} />
          ) : (
            <p className={ui.lbl} style={{ marginTop: 16 }}>
              {t('tooShort')}
            </p>
          )}
        </div>
      </section>

      {result && (
        <>
          <section className={s.two}>
            <div>
              <h2 className={s.h2}>{t('measuredTitle')}</h2>
              <div className={s.stats}>
                <div className={s.stat}>
                  <b>{metrics.avgWordsPerTurn}</b>
                  <span className={ui.lbl}>{t('wordsPerTurn')}</span>
                </div>
                <div className={s.stat}>
                  <b>
                    {metrics.longestTurnWords}
                    <small> {unit(metrics.longestTurnWords)}</small>
                  </b>
                  <span className={ui.lbl}>{t('longestTurn')}</span>
                </div>
                <div className={s.stat}>
                  <b>
                    {metrics.fillerCount}
                    <small> · {metrics.fillersPerHundredWords}/100</small>
                  </b>
                  <span className={ui.lbl}>{t('fillers')}</span>
                </div>
                <div className={s.stat}>
                  <b>{metrics.repeats}</b>
                  <span className={ui.lbl}>{t('repeats')}</span>
                </div>
                <div className={s.stat}>
                  <b>{metrics.interruptions}</b>
                  <span className={ui.lbl}>{t('cutOff')}</span>
                </div>
              </div>
            </div>
            <div>
              <h2 className={s.h2}>{t('skillsTitle')}</h2>
              {(Object.keys(SKILLS) as (keyof AuditResult['skills'])[]).map((k) => (
                <div key={k} className={s.sk}>
                  <div className={s.skRow}>
                    <span>{t(SKILLS[k])}</span>
                    <span>{result.skills[k]}/10</span>
                  </div>
                  <div className={s.bar}>
                    <i style={{ width: `${result.skills[k] * 10}%` }} />
                    <svg style={{ left: `calc(${result.skills[k] * 10}% - 10px)` }} viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 20 C 3 11 9 4 20 3 C 21 13 15 20 4 20 Z" fill="#ee6a1f" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {camera.length > 0 && (
            <section>
              <h2 className={s.h2}>
                {t('cameraMoments')} <span className={ui.lbl}>{t('cameraMomentsNote')}</span>
              </h2>
              <ul className={s.camera}>
                {camera.map((e, i) => (
                  <li key={i}>
                    <span>{fmt(e.at)}</span>
                    {e.text}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.wording && result.wording.length > 0 && (
            <section>
              <h2 className={s.h2}>
                {t('wordingTitle')} <span className={ui.lbl}>{t('wordingNote')}</span>
              </h2>
              <ul className={s.wording}>
                {result.wording.map((w, i) => (
                  <li key={i}>
                    <button type="button" className={s.wTime} onClick={() => jump(w.turn)}>
                      {fmt(turns[w.turn]?.at ?? 0)}
                    </button>
                    <div>
                      <p className={s.wLine}>
                        <small>{t('wordingSaid')}</small>
                        <span className={s.wBad}>“{w.said}”</span>
                      </p>
                      <p className={s.wLine}>
                        <small>{t('wordingBetter')}</small>
                        <span className={s.wGood}>“{w.better}”</span>
                      </p>
                    </div>
                    {w.note && <p className={s.wNote}>{w.note}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={s.two}>
            {result.nextFocus.length > 0 && (
              <div>
                <h2 className={s.h2}>{t('workNext')}</h2>
                <ol className={s.next}>
                  {result.nextFocus.map((f, i) => (
                    <li key={i}>
                      <b>{String(i + 1).padStart(2, '0')}</b>
                      <span>{f}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {!sample && <ClipMaker session={session} scenario={config.scenario} persona={persona} turns={turns} audit={result} lang={lang} userGender={config.user?.gender} open={config.provider === 'open'} />}
          </section>

          {trace && trace.length > 0 && (
            <section className={s.trace} aria-label={t('traceTitle')}>
              <h2 className={s.h2}>{t('traceTitle')}</h2>
              <p className={s.traceLead}>{t('traceLead')}</p>
              <div className={s.traceWrap}>
                <table className={s.traceTable}>
                  <thead>
                    <tr>
                      <th>{t('traceWhat')}</th>
                      <th>{t('traceModel')}</th>
                      <th>{t('traceWhere')}</th>
                      <th>{t('traceCalls')}</th>
                      <th>{t('traceTime')}</th>
                      <th>{t('traceCost')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trace.map((r) => (
                      <tr key={`${r.kind}|${r.model}|${r.served}`} data-open={r.open}>
                        <td>{t('traceRole', r.kind)}</td>
                        <td>
                          <code>{r.model}</code>
                        </td>
                        <td>{r.served}</td>
                        <td>{r.calls}</td>
                        <td>{r.medianMs === null ? '–' : `${(r.medianMs / 1000).toFixed(1)} s`}</td>
                        <td>{r.costUsd > 0 ? `$${r.costUsd.toFixed(3)}` : '$0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {trace.some((r) => r.open) && <p className={s.traceNote}>{t('traceOpenNote')}</p>}
            </section>
          )}
        </>
      )}

      <section>
        <div className={s.rhead}>
          <h2 className={s.rtitle}>{t('replay')}</h2>
          <Switch checked={mind} onChange={setMind}>
            {t('readMind')}
          </Switch>
        </div>
        <div className={`${s.rp} ${mind ? '' : s.off}`}>
          {turns.map((turn, i) => {
            const bot = turn.role === 'bot';
            const m = momentByTurn.get(i);
            const color = m ? KIND_COLOR[m.kind] : bot ? MOOD_COLOR[turn.mood ?? 3] : 'var(--clay)';
            return (
              <div key={i} ref={(el) => void (rows.current[i] = el)} className={`${s.rw} ${bot ? '' : s.me}`}>
                <div className={s.lt}>
                  <div className={s.tg}>
                    <span>{bot ? first : t('you')}</span>
                    <span>{fmt(turn.at)}</span>
                  </div>
                  <p className={bot ? s.tD : s.tM}>{turn.text}</p>
                </div>
                <span className={`${s.nd} ${m ? s.ndBig : ''}`} style={vars({ '--c': color })} />
                <div className={s.rt}>
                  {bot && turn.thought && (
                    <p className={s.th} style={vars({ '--c': MOOD_COLOR[turn.mood ?? 3] })}>
                      <span className={ui.sr}>{t('thinks')} </span>
                      {turn.thought}
                    </p>
                  )}
                  {m && (
                    <div className={s.an} style={vars({ '--c': KIND_COLOR[m.kind] })}>
                      <span className={s.chip}>
                        {letters.get(i) ? `${letters.get(i)} · ` : ''}
                        {kindLabel(m.kind)}
                      </span>
                      <p>{m.what}</p>
                      <p className={s.why}>{m.why}</p>
                      {m.betterLine && (
                        <div className={s.say}>
                          <small>{t('sayInstead')}</small>“{m.betterLine}”
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
