import { useEffect, useRef, useState } from 'react';
import type { FaceBox, FramingEvent } from '../../shared/framing.ts';
import type { SessionConfig, Turn } from '../../shared/types.ts';
import { langOf } from '../../shared/lang.ts';
import { scenarioDef } from '../../shared/scenarios.ts';
import { CallEngine, type CallSnapshot } from '../engine/CallEngine.ts';
import { Portrait } from '../components/Portrait.tsx';
import { moodLabel, t, useLang } from '../i18n/index.ts';
import { CameraWatch } from '../lib/camera.ts';
import { ScreenShare } from '../lib/screen.ts';

const MOOD_COLOR = ['', '#ef4444', '#f59e0b', '#9ca3af', '#84cc16', '#22c55e'];

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export function CallScreen({
  session,
  config,
  onEnd,
}: {
  session: string;
  config: SessionConfig;
  onEnd: (turns: Turn[], durationMs: number, hungUp: boolean, camera: FramingEvent[]) => void;
}) {
  useLang();
  const lang = langOf(config);
  const [snap, setSnap] = useState<CallSnapshot | null>(null);
  const [typed, setTyped] = useState('');
  const engine = useRef<CallEngine | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const ended = useRef(false);
  const share = useRef<ScreenShare | null>(null);
  const [sharing, setSharing] = useState(false);
  const [seen, setSeen] = useState('');
  const cam = useRef<CameraWatch | null>(null);
  const cameraEvents = useRef<FramingEvent[]>([]);
  const callStart = useRef(Date.now());
  const [camOn, setCamOn] = useState(false);
  const [face, setFace] = useState<FaceBox | null>(null);
  const selfView = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const e = new CallEngine(config, session, setSnap);
    engine.current = e;
    e.start();
    return () => {
      e.dispose();
      share.current?.stop();
      cam.current?.stop();
    };
  }, [config, session]);

  async function toggleShare() {
    if (share.current?.active) {
      share.current.stop();
      engine.current?.setScreen(undefined);
      setSharing(false);
      setSeen('');
      return;
    }
    const s = new ScreenShare(
      async (image) => {
        const r = await fetch('/api/eye', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session, scenario: config.scenario, topic: config.topic, image, lang }),
        }).catch(() => null);
        return r?.ok ? ((await r.json()) as { notes: string }).notes : null;
      },
      (notes, first) => {
        setSeen(notes);
        engine.current?.setScreen(notes, first);
      },
    );
    s.onEnded = () => {
      engine.current?.setScreen(undefined);
      setSharing(false);
      setSeen('');
    };
    share.current = s;
    setSharing(await s.start());
  }


  async function toggleCamera() {
    if (cam.current?.stream) {
      cam.current.stop();
      setCamOn(false);
      setFace(null);
      return;
    }
    const c = new CameraWatch(session, () => Date.now() - callStart.current);
    c.onFace = setFace;
    c.onEvents = (ev) => {
      cameraEvents.current = [...cameraEvents.current, ...ev];
    };
    cam.current = c;
    const ok = await c.start();
    setCamOn(ok);
  }

  useEffect(() => {
    if (selfView.current && camOn) selfView.current.srcObject = cam.current?.stream ?? null;
  }, [camOn]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [snap?.turns.length, snap?.liveBot, snap?.liveUser]);

  useEffect(() => {
    if (snap?.state === 'ended' && !ended.current) {
      ended.current = true;
      const t = window.setTimeout(() => onEnd(snap.turns, snap.elapsedMs, snap.endReason === 'hangup', cameraEvents.current), snap.endReason === 'hangup' ? 2500 : 600);
      return () => window.clearTimeout(t);
    }
  }, [snap, onEnd]);

  if (!snap) return null;
  const p = config.persona;
  const sc = scenarioDef(config.scenario, lang);
  const first = p.name.split(' ')[0]!;
  const statusText = {
    connecting: t('connecting'),
    listening: t('listening'),
    thinking: t('thinking', first),
    speaking: t('speaking', first),
    ended: snap.endReason === 'hangup' ? t('hungUpBy', first, p.gender) : t('callEnded'),
  }[snap.state];

  return (
    <main className="mx-auto grid h-full max-w-5xl gap-4 px-6 py-6 md:grid-cols-[260px_1fr]">
      <aside className="flex items-center gap-4 md:flex-col md:items-stretch md:gap-3">
        <Portrait session={session} scenario={config.scenario} persona={p} lang={lang} mood={snap.mood} className="h-20 w-20 shrink-0 md:h-auto md:w-full md:aspect-square" />
        <div className="min-w-0 flex-1 md:flex-none">
          <div className="text-lg font-medium leading-tight">{p.name}</div>
          <div className="text-sm text-[var(--muted)]">
            {p.role} · {sc.title}
          </div>
          {engine.current?.voiceName && <div className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{t('voiceInUse', engine.current.voiceName)}</div>}
          {config.provider === 'open' && (
            <div className="mt-1 inline-block rounded-full border border-[var(--accent)] px-2 py-0.5 text-[11px] text-[var(--accent)]">{t('openBadge')}</div>
          )}
          <div className="mt-2 flex items-center gap-3">
            <div className="text-sm" style={{ color: MOOD_COLOR[snap.mood] }}>
              {moodLabel(snap.mood, lang, p.gender)}
            </div>
            <div className="text-xs tabular-nums text-[var(--muted)]">{fmt(snap.elapsedMs)}</div>
          </div>
          <div className="mt-1 flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= snap.mood ? MOOD_COLOR[snap.mood] : '#232838', transition: 'background .6s' }} />
            ))}
          </div>
        </div>
        {camOn && (
          <div className="relative hidden aspect-[4/3] overflow-hidden rounded-xl border border-[var(--line)] bg-black md:block">
            <video ref={selfView} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
            {face && (
              <div
                className="absolute rounded border-2 border-[var(--accent)]"
                style={{
                  left: `${(1 - face.x2 / face.w) * 100}%`,
                  top: `${(face.y1 / face.h) * 100}%`,
                  width: `${((face.x2 - face.x1) / face.w) * 100}%`,
                  height: `${((face.y2 - face.y1) / face.h) * 100}%`,
                  transition: 'all .4s',
                }}
              />
            )}
            <span className="absolute bottom-1 left-2 text-[10px] text-white/70">{t('samBadge')}</span>
          </div>
        )}
      </aside>

      <section className="flex min-h-0 flex-col">
      <div ref={scroller} className="mb-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {snap.turns.map((t, i) => (
          <Bubble key={i} turn={t} name={p.name.split(' ')[0]!} />
        ))}
        {snap.liveBot && <Bubble turn={{ role: 'bot', text: snap.liveBot, at: 0 }} name={p.name.split(' ')[0]!} live />}
        {snap.liveUser && <Bubble turn={{ role: 'user', text: snap.liveUser, at: 0 }} name={t('you')} live />}
      </div>

      {sharing && (
        <details className="mb-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--muted)]">
          <summary className="cursor-pointer">{seen ? t('canSee', first) : t('sharingLooking')}</summary>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed">{seen}</p>
        </details>
      )}

      {snap.error && <p className="mb-2 text-sm text-amber-400">{snap.error}</p>}

      <footer className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <span className={`h-2 w-2 rounded-full ${snap.state === 'listening' ? 'animate-pulse bg-green-400' : 'bg-[#3a4160]'}`} />
            {statusText}
            {snap.lastLatencyMs != null && <span className="ml-2 text-xs">{t('firstWord', (snap.lastLatencyMs / 1000).toFixed(1))}</span>}
          </div>
          {CameraWatch.supported() && (
            <button
              onClick={toggleCamera}
              disabled={snap.state === 'ended'}
              className={`ml-auto mr-2 rounded-lg border px-3 py-2 text-sm transition ${camOn ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--line)] hover:border-[#3a4160]'}`}
            >
              {camOn ? t('cameraOff') : t('cameraOn')}
            </button>
          )}
          {ScreenShare.supported() && (
            <button
              onClick={toggleShare}
              disabled={snap.state === 'ended'}
              className={`mr-2 rounded-lg border px-3 py-2 text-sm transition ${sharing ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--line)] hover:border-[#3a4160]'}`}
            >
              {sharing ? t('stopSharing') : t('shareScreen')}
            </button>
          )}
          <button
            onClick={() => engine.current?.hangUp()}
            disabled={snap.state === 'ended'}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-40"
          >
            {t('hangUp')}
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
            placeholder={t('typePlaceholder')}
            className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </form>
      </footer>
      </section>
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
        <div className="mb-0.5 text-xs text-[var(--muted)]">{bot ? name : t('you')}</div>
        <div className="leading-relaxed">{turn.text}</div>
      </div>
    </div>
  );
}
