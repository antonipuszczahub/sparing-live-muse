import { useEffect, useRef, useState } from 'react';
import { measureDelivery, type AuditResult, type Moment } from '../../shared/audit.ts';
import type { FramingEvent } from '../../shared/framing.ts';
import type { SessionConfig, Turn } from '../../shared/types.ts';
import { ApiError, requestAudit } from '../lib/api.ts';
import { recordWeakSpots } from '../lib/memory.ts';

const KIND_STYLE: Record<Moment['kind'], { label: string; color: string }> = {
  strength: { label: 'Strength', color: '#22c55e' },
  mistake: { label: 'Mistake', color: '#ef4444' },
  'turning-point': { label: 'Turning point', color: '#f59e0b' },
};
const OUTCOME: Record<AuditResult['outcome'], { label: string; color: string }> = {
  won: { label: 'Goal reached', color: '#22c55e' },
  partial: { label: 'Partly there', color: '#f59e0b' },
  lost: { label: 'Not this time', color: '#ef4444' },
};
const SKILL_LABEL: Record<keyof AuditResult['skills'], string> = {
  clarity: 'Clarity',
  listening: 'Listening',
  objections: 'Handling objections',
  specificity: 'Specificity',
  composure: 'Composure',
};
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
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState('');
  const [secs, setSecs] = useState(0);
  const [mind, setMind] = useState(true);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const metrics = measureDelivery(turns, durationMs, hungUp);

  useEffect(() => {
    let live = true;
    requestAudit({ session, config, turns, durationMs, hungUp, camera })
      .then((r) => {
        if (!live) return;
        recordWeakSpots(r.weaknessTags);
        setResult(r);
      })
      .catch((e) => live && setError(e instanceof ApiError && e.budget ? 'The daily budget is used up. Come back tomorrow.' : (e as Error).message));
    return () => {
      live = false;
    };
  }, [session, config, turns, durationMs, hungUp, camera]);

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
          <h1 className="text-2xl font-semibold tracking-tight">Call review</h1>
          <p className="text-sm text-[var(--muted)]">
            {config.persona.name} · {fmt(durationMs)} · {metrics.userTurns} turns{hungUp ? ' · they hung up' : ''}
          </p>
        </div>
        <button onClick={onAgain} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:brightness-110">
          New call
        </button>
      </div>

      {!result && !error && (
        <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6">
          <div className="font-medium">Muse Wonder is reviewing your call… {secs}s</div>
          <p className="mt-1 text-sm text-[var(--muted)]">It reads the transcript together with what {config.persona.name.split(' ')[0]} was privately thinking. Usually 10 to 25 seconds.</p>
        </div>
      )}
      {error && <p className="mt-8 rounded-xl border border-red-500/40 p-4 text-red-300">{error}</p>}

      {result && (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr]">
            <div className="flex h-32 w-32 flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
              <div className="text-5xl font-semibold tabular-nums">{result.score}</div>
              <div className="text-xs" style={{ color: OUTCOME[result.outcome].color }}>
                {OUTCOME[result.outcome].label}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
              <div className="text-lg font-medium leading-snug">{result.verdict}</div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{result.summary}</p>
            </div>
          </section>

          <section className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <div className="mb-3 text-sm text-[var(--muted)]">Skills</div>
              {(Object.keys(SKILL_LABEL) as (keyof AuditResult['skills'])[]).map((k) => (
                <div key={k} className="mb-2">
                  <div className="flex justify-between text-sm">
                    <span>{SKILL_LABEL[k]}</span>
                    <span className="tabular-nums text-[var(--muted)]">{result.skills[k]}/10</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[#232838]">
                    <div className="h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${result.skills[k] * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <div className="mb-3 text-sm text-[var(--muted)]">Measured from the call</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-[var(--muted)]">Words per turn</dt>
                <dd className="text-right tabular-nums">{metrics.avgWordsPerTurn}</dd>
                <dt className="text-[var(--muted)]">Longest turn</dt>
                <dd className="text-right tabular-nums">{metrics.longestTurnWords} words</dd>
                <dt className="text-[var(--muted)]">Filler words</dt>
                <dd className="text-right tabular-nums">
                  {metrics.fillerCount} ({metrics.fillersPerHundredWords}/100)
                </dd>
                <dt className="text-[var(--muted)]">Times you cut them off</dt>
                <dd className="text-right tabular-nums">{metrics.interruptions}</dd>
              </dl>
              <div className="mt-4 text-sm text-[var(--muted)]">Their attitude over the call</div>
              <MoodLine turns={turns} onPick={jump} />
            </div>
          </section>

          {camera.length > 0 && (
            <section className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <div className="mb-2 text-sm text-[var(--muted)]">Camera moments <span className="text-xs">(framing only, from SAM 3.1)</span></div>
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
              <div className="mb-2 text-sm text-[var(--muted)]">Work on next</div>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {result.nextFocus.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Replay</h2>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--muted)]">
            <input type="checkbox" checked={mind} onChange={(e) => setMind(e.target.checked)} />
            Read their mind
          </label>
        </div>
        <div className="space-y-3">
          {turns.map((t, i) => {
            const m = momentByTurn.get(i);
            const bot = t.role === 'bot';
            return (
              <div key={i} ref={(el) => void (rows.current[i] = el)}>
                <div className={`flex ${bot ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${bot ? 'border border-[var(--line)] bg-[var(--panel)]' : 'bg-[#1e3a63]'}`}
                    style={m ? { outline: `2px solid ${KIND_STYLE[m.kind].color}` } : undefined}
                  >
                    <div className="mb-0.5 flex gap-2 text-xs text-[var(--muted)]">
                      <span>{bot ? config.persona.name.split(' ')[0] : 'You'}</span>
                      <span>{fmt(t.at)}</span>
                    </div>
                    <div className="leading-relaxed">{t.text}</div>
                    {bot && mind && t.thought && (
                      <div className="mt-2 border-t border-[var(--line)] pt-2 text-sm italic" style={{ color: MOOD_COLOR[t.mood ?? 3] }}>
                        thinks: {t.thought}
                      </div>
                    )}
                  </div>
                </div>
                {m && (
                  <div className="ml-4 mt-2 max-w-[90%] rounded-xl border-l-4 bg-[#10141d] p-3 text-sm" style={{ borderColor: KIND_STYLE[m.kind].color }}>
                    <div className="text-xs font-medium uppercase tracking-wide" style={{ color: KIND_STYLE[m.kind].color }}>
                      {KIND_STYLE[m.kind].label}
                    </div>
                    <p className="mt-1 leading-relaxed">{m.what}</p>
                    <p className="mt-1 leading-relaxed text-[var(--muted)]">{m.why}</p>
                    {m.betterLine && (
                      <p className="mt-2 rounded-lg bg-[#16301f] px-3 py-2 leading-relaxed text-green-200">
                        <span className="text-xs uppercase tracking-wide text-green-400">Say this instead</span>
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
  if (pts.length < 2) return <div className="mt-2 text-xs text-[var(--muted)]">Too short to chart.</div>;
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
