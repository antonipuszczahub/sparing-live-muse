import { useEffect, useRef, useState } from 'react';
import { measureDelivery, type AuditResult, type Moment } from '../../shared/audit.ts';
import type { FramingEvent } from '../../shared/framing.ts';
import { langOf } from '../../shared/lang.ts';
import type { SessionConfig, Turn } from '../../shared/types.ts';
import { t, useLang } from '../i18n/index.ts';
import { ApiError, requestAudit } from '../lib/api.ts';
import { ClipMaker } from '../components/ClipMaker.tsx';
import { recordWeakSpots } from '../lib/memory.ts';

const KIND_COLOR: Record<Moment['kind'], string> = { strength: '#22c55e', mistake: '#ef4444', 'turning-point': '#f59e0b' };
const kindLabel = (k: Moment['kind']) => t(k === 'strength' ? 'kindStrength' : k === 'mistake' ? 'kindMistake' : 'kindTurning');
const OUTCOME_COLOR: Record<AuditResult['outcome'], string> = { won: '#22c55e', partial: '#f59e0b', lost: '#ef4444' };
const outcomeLabel = (o: AuditResult['outcome']) => t(o === 'won' ? 'outcomeWon' : o === 'partial' ? 'outcomePartial' : 'outcomeLost');
const SKILLS = {
  clarity: 'skillClarity',
  listening: 'skillListening',
  objections: 'skillObjections',
  specificity: 'skillSpecificity',
  composure: 'skillComposure',
} as const satisfies Record<keyof AuditResult['skills'], string>;
const MOOD_COLOR = ['', '#ef4444', '#f59e0b', '#9ca3af', '#84cc16', '#22c55e'];

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export function ReportScreen({
  session,
  config,
  turns,
  durationMs,
  hungUp,
  camera,
  onAgain,
}: {
  session: string;
  config: SessionConfig;
  turns: Turn[];
  durationMs: number;
  hungUp: boolean;
  camera: FramingEvent[];
  onAgain: () => void;
}) {
  useLang();
  const lang = langOf(config);
  const first = config.persona.name.split(' ')[0]!;
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState('');
  const [secs, setSecs] = useState(0);
  const [mind, setMind] = useState(true);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const metrics = measureDelivery(turns, durationMs, hungUp, lang);

  useEffect(() => {
    let live = true;
    requestAudit({ session, config, turns, durationMs, hungUp, camera })
      .then((r) => {
        if (!live) return;
        recordWeakSpots(r.weaknessTags, lang);
        setResult(r);
      })
      .catch((e) => live && setError(e instanceof ApiError && e.budget ? t('budgetUsedUp') : (e as Error).message));
    return () => {
      live = false;
    };
  }, [session, config, turns, durationMs, hungUp, camera, lang]);

  useEffect(() => {
    if (result || error) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [result, error]);

  const jump = (i: number) => rows.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const momentByTurn = new Map(result?.moments.map((m) => [m.turn, m]));

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('reviewTitle')}</h1>
          <p className="text-sm text-[var(--muted)]">
            {t('reviewMeta', config.persona.name, fmt(durationMs), metrics.userTurns, hungUp, config.persona.gender)}
          </p>
        </div>
        <button onClick={onAgain} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:brightness-110">
          {t('newCall')}
        </button>
      </div>

      {!result && !error && (
        <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6">
          <div className="font-medium">{t('reviewing', secs)}</div>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('reviewingNote', first)}</p>
        </div>
      )}
      {error && <p className="mt-8 rounded-xl border border-red-500/40 p-4 text-red-300">{error}</p>}

      {result && (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr]">
            <div className="flex h-32 w-32 flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
              <div className="text-5xl font-semibold tabular-nums">{result.score}</div>
              <div className="text-xs" style={{ color: OUTCOME_COLOR[result.outcome] }}>
                {outcomeLabel(result.outcome)}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
              <div className="text-lg font-medium leading-snug">{result.verdict}</div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{result.summary}</p>
            </div>
          </section>

          <section className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <div className="mb-3 text-sm text-[var(--muted)]">{t('skillsTitle')}</div>
              {(Object.keys(SKILLS) as (keyof AuditResult['skills'])[]).map((k) => (
                <div key={k} className="mb-2">
                  <div className="flex justify-between text-sm">
                    <span>{t(SKILLS[k])}</span>
                    <span className="tabular-nums text-[var(--muted)]">{result.skills[k]}/10</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[#232838]">
                    <div className="h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${result.skills[k] * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <div className="mb-3 text-sm text-[var(--muted)]">{t('measuredTitle')}</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-[var(--muted)]">{t('wordsPerTurn')}</dt>
                <dd className="text-right tabular-nums">{metrics.avgWordsPerTurn}</dd>
                <dt className="text-[var(--muted)]">{t('longestTurn')}</dt>
                <dd className="text-right tabular-nums">{t('words', metrics.longestTurnWords)}</dd>
                <dt className="text-[var(--muted)]">{t('fillers')}</dt>
                <dd className="text-right tabular-nums">
                  {metrics.fillerCount} ({metrics.fillersPerHundredWords}/100)
                </dd>
                <dt className="text-[var(--muted)]">{t('cutOff')}</dt>
                <dd className="text-right tabular-nums">{metrics.interruptions}</dd>
              </dl>
              <div className="mt-4 text-sm text-[var(--muted)]">{t('attitude')}</div>
              <MoodLine turns={turns} onPick={jump} />
            </div>
          </section>

          {camera.length > 0 && (
            <section className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <div className="mb-2 text-sm text-[var(--muted)]">{t('cameraMoments')} <span className="text-xs">{t('cameraMomentsNote')}</span></div>
              <ul className="space-y-1 text-sm">
                {camera.map((e, i) => (
                  <li key={i}>
                    <span className="tabular-nums text-[var(--muted)]">{fmt(e.at)}</span> {e.text}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.nextFocus.length > 0 && (
            <section className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <div className="mb-2 text-sm text-[var(--muted)]">{t('workNext')}</div>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {result.nextFocus.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ClipMaker session={session} scenario={config.scenario} persona={config.persona} turns={turns} audit={result} lang={lang} userGender={config.user?.gender} />

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">{t('replay')}</h2>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--muted)]">
            <input type="checkbox" checked={mind} onChange={(e) => setMind(e.target.checked)} />
            {t('readMind')}
          </label>
        </div>
        <div className="space-y-3">
          {turns.map((turn, i) => {
            const m = momentByTurn.get(i);
            const bot = turn.role === 'bot';
            return (
              <div key={i} ref={(el) => void (rows.current[i] = el)}>
                <div className={`flex ${bot ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${bot ? 'border border-[var(--line)] bg-[var(--panel)]' : 'bg-[#1e3a63]'}`}
                    style={m ? { outline: `2px solid ${KIND_COLOR[m.kind]}` } : undefined}
                  >
                    <div className="mb-0.5 flex gap-2 text-xs text-[var(--muted)]">
                      <span>{bot ? first : t('you')}</span>
                      <span>{fmt(turn.at)}</span>
                    </div>
                    <div className="leading-relaxed">{turn.text}</div>
                    {bot && mind && turn.thought && (
                      <div className="mt-2 border-t border-[var(--line)] pt-2 text-sm italic" style={{ color: MOOD_COLOR[turn.mood ?? 3] }}>
                        {t('thinks')} {turn.thought}
                      </div>
                    )}
                  </div>
                </div>
                {m && (
                  <div className="ml-4 mt-2 max-w-[90%] rounded-xl border-l-4 bg-[#10141d] p-3 text-sm" style={{ borderColor: KIND_COLOR[m.kind] }}>
                    <div className="text-xs font-medium uppercase tracking-wide" style={{ color: KIND_COLOR[m.kind] }}>
                      {kindLabel(m.kind)}
                    </div>
                    <p className="mt-1 leading-relaxed">{m.what}</p>
                    <p className="mt-1 leading-relaxed text-[var(--muted)]">{m.why}</p>
                    {m.betterLine && (
                      <p className="mt-2 rounded-lg bg-[#16301f] px-3 py-2 leading-relaxed text-green-200">
                        <span className="text-xs uppercase tracking-wide text-green-400">{t('sayInstead')}</span>
                        <br />“{m.betterLine}”
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function MoodLine({ turns, onPick }: { turns: Turn[]; onPick: (i: number) => void }) {
  const pts = turns.map((t, i) => ({ t, i })).filter((p) => p.t.role === 'bot' && p.t.mood);
  if (pts.length < 2) return <div className="mt-2 text-xs text-[var(--muted)]">{t('tooShort')}</div>;
  const W = 260;
  const H = 70;
  const x = (k: number) => 8 + (k * (W - 16)) / (pts.length - 1);
  const y = (mood: number) => H - 8 - ((mood - 1) / 4) * (H - 16);
  const path = pts.map((p, k) => `${k ? 'L' : 'M'}${x(k)},${y(p.t.mood!)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full">
      <path d={path} fill="none" stroke="#6aa6ff" strokeWidth="2" />
      {pts.map((p, k) => (
        <circle key={k} cx={x(k)} cy={y(p.t.mood!)} r="4.5" fill={MOOD_COLOR[p.t.mood!]} className="cursor-pointer" onClick={() => onPick(p.i)} />
      ))}
    </svg>
  );
}
