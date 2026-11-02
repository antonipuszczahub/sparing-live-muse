import { useRef, useState } from 'react';
import { measureDelivery, type AuditResult, type Moment } from '../../shared/audit.ts';
import type { FramingEvent } from '../../shared/framing.ts';
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
  error: string;
  /** Seconds the review has been running, for the wait message. */
  secs: number;
  onAgain: () => void;
}

/** The review: score, the mood vine, the numbers, and the replay with what the character was thinking. */
export function ReportView({ session, config, turns, durationMs, hungUp, camera, result, error, secs, onAgain }: ReportViewProps) {
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

  return (
    <main className={s.page}>
      <header className={`${s.top} ${ui.rise1}`}>
        <Brand size={32} />
        <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={onAgain}>
          {t('newCall')}
          <Icon name="arrow" size={18} stroke={2} />
        </button>
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
              <p className={s.sum}>{result.summary}</p>
            </>
          ) : error ? (
            <p className={`${ui.note} ${ui.noteBad}`} style={{ marginTop: 18 }}>
              {error}
            </p>
          ) : (
            <div className={s.reviewing}>
              <svg viewBox="0 0 180 48" aria-hidden="true">
                <path pathLength={1} d="M4 38 C 30 6, 52 44, 80 22 S 130 6, 172 16" fill="none" stroke="#cdb67e" strokeWidth="3.4" strokeLinecap="round" />
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
                      <path d="M4 20 C 3 11 9 4 20 3 C 21 13 15 20 4 20 Z" fill="#e6d6a8" />
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
            <ClipMaker session={session} scenario={config.scenario} persona={persona} turns={turns} audit={result} lang={lang} userGender={config.user?.gender} />
          </section>
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
