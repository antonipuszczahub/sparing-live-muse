import { useEffect, useRef, useState } from 'react';
import type { SessionConfig, Turn } from '../../shared/types.ts';
import { SCENARIOS } from '../../shared/scenarios.ts';
import { CallEngine, type CallSnapshot } from '../engine/CallEngine.ts';

const MOOD_LABEL = ['', 'Hostile', 'Cold', 'Neutral', 'Warming up', 'Won over'];
const MOOD_COLOR = ['', '#ef4444', '#f59e0b', '#9ca3af', '#84cc16', '#22c55e'];

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export function CallScreen({
  session,
  config,
  onEnd,
}: {
  session: string;
  config: SessionConfig;
  onEnd: (turns: Turn[], durationMs: number, hungUp: boolean) => void;
}) {
  const [snap, setSnap] = useState<CallSnapshot | null>(null);
  const [typed, setTyped] = useState('');
  const engine = useRef<CallEngine | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const ended = useRef(false);

  useEffect(() => {
    const e = new CallEngine(config, session, setSnap);
    engine.current = e;
    e.start();
    return () => e.dispose();
  }, [config, session]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [snap?.turns.length, snap?.liveBot, snap?.liveUser]);

  useEffect(() => {
    if (snap?.state === 'ended' && !ended.current) {
      ended.current = true;
      const t = window.setTimeout(() => onEnd(snap.turns, snap.elapsedMs, snap.endReason === 'hangup'), snap.endReason === 'hangup' ? 2500 : 600);
      return () => window.clearTimeout(t);
    }
  }, [snap, onEnd]);

  if (!snap) return null;
  const p = config.persona;
  const sc = SCENARIOS[config.scenario];
  const statusText = {
    connecting: 'Connecting…',
    listening: 'Listening',
    thinking: `${p.name.split(' ')[0]} is thinking…`,
    speaking: `${p.name.split(' ')[0]} is speaking`,
    ended: snap.endReason === 'hangup' ? `${p.name.split(' ')[0]} hung up` : 'Call ended',
  }[snap.state];

  return (
    <main className="mx-auto flex h-full max-w-3xl flex-col px-6 py-6">
      <header className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <div>
          <div className="text-lg font-medium">{p.name}</div>
          <div className="text-sm text-[var(--muted)]">
            {p.role} · {sc.title}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm" style={{ color: MOOD_COLOR[snap.mood] }}>
            {MOOD_LABEL[snap.mood]}
          </div>
          <div className="mt-1 flex justify-end gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="h-1.5 w-6 rounded-full" style={{ background: i <= snap.mood ? MOOD_COLOR[snap.mood] : '#232838' }} />
            ))}
          </div>
          <div className="mt-1 text-xs tabular-nums text-[var(--muted)]">{fmt(snap.elapsedMs)}</div>
        </div>
      </header>

      <div ref={scroller} className="my-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {snap.turns.map((t, i) => (
          <Bubble key={i} turn={t} name={p.name.split(' ')[0]!} />
        ))}
        {snap.liveBot && <Bubble turn={{ role: 'bot', text: snap.liveBot, at: 0 }} name={p.name.split(' ')[0]!} live />}
        {snap.liveUser && <Bubble turn={{ role: 'user', text: snap.liveUser, at: 0 }} name="You" live />}
      </div>

      {snap.error && <p className="mb-2 text-sm text-amber-400">{snap.error}</p>}

      <footer className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <span className={`h-2 w-2 rounded-full ${snap.state === 'listening' ? 'animate-pulse bg-green-400' : 'bg-[#3a4160]'}`} />
            {statusText}
            {snap.lastLatencyMs != null && <span className="ml-2 text-xs">first word {(snap.lastLatencyMs / 1000).toFixed(1)} s</span>}
          </div>
          <button
            onClick={() => engine.current?.hangUp()}
            disabled={snap.state === 'ended'}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-40"
          >
            Hang up
          </button>
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) engine.current?.sendText(typed.trim());
            setTyped('');
          }}
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Or type instead of speaking…"
            className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </form>
      </footer>
    </main>
  );
}

function Bubble({ turn, name, live }: { turn: Turn; name: string; live?: boolean }) {
  const bot = turn.role === 'bot';
  return (
    <div className={`flex ${bot ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          bot ? 'bg-[var(--panel)] border border-[var(--line)]' : 'bg-[#1e3a63]'
        } ${live ? 'opacity-70' : ''}`}
      >
        <div className="mb-0.5 text-xs text-[var(--muted)]">{bot ? name : 'You'}</div>
        <div className="leading-relaxed">{turn.text}</div>
      </div>
    </div>
  );
}
