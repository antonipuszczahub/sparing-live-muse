import { useEffect, useRef, useState } from 'react';
import type { FaceBox, FramingEvent } from '../../shared/framing.ts';
import type { SessionConfig, Turn } from '../../shared/types.ts';
import { langOf } from '../../shared/lang.ts';
import { CallEngine, type CallSnapshot } from '../engine/CallEngine.ts';
import { useLang } from '../i18n/index.ts';
import { CameraWatch } from '../lib/camera.ts';
import { useMoodTheme } from '../lib/useMoodTheme.ts';
import { ScreenShare } from '../lib/screen.ts';
import { keepAwake } from '../lib/wakeLock.ts';
import { CallView } from './CallView.tsx';

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

  // The light and the portrait ring follow how the character feels.
  useMoodTheme(snap?.mood ?? 3);

  // A phone must not dim and lock in the middle of a call.
  useEffect(() => keepAwake(), []);

  useEffect(() => {
    // A discarded engine (React mounts effects twice in development) must not report its own ending as the call's.
    let live = true;
    const e = new CallEngine(config, session, (s) => live && setSnap(s));
    engine.current = e;
    e.start();
    return () => {
      live = false;
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

  // Once the call has ended, the review follows after a moment. The engine can still emit snapshots in that moment,
  // so the timer belongs to the component, not to the effect that started it.
  const onEndNow = useRef(onEnd);
  onEndNow.current = onEnd;
  const endTimer = useRef(0);
  useEffect(() => {
    if (snap?.state !== 'ended' || ended.current) return;
    ended.current = true;
    endTimer.current = window.setTimeout(
      () => onEndNow.current(snap.turns, snap.elapsedMs, snap.endReason === 'hangup', cameraEvents.current),
      snap.endReason === 'hangup' ? 2500 : 600,
    );
  }, [snap]);
  useEffect(() => () => window.clearTimeout(endTimer.current), []);

  // M mutes and unmutes the microphone, unless a text field has the keyboard
  const mutedNow = useRef(false);
  mutedNow.current = Boolean(snap?.muted);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'm' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      engine.current?.setMuted(!mutedNow.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!snap) return null;
  return (
    <CallView
      session={session}
      config={config}
      snap={snap}
      voiceName={engine.current?.voiceName}
      camOn={camOn}
      face={face}
      selfView={selfView}
      sharing={sharing}
      seen={seen}
      typed={typed}
      canCamera={CameraWatch.supported()}
      canShare={ScreenShare.supported()}
      onTyped={setTyped}
      onSend={() => {
        if (typed.trim()) engine.current?.sendText(typed.trim());
        setTyped('');
      }}
      onMute={() => engine.current?.setMuted(!snap.muted)}
      onCamera={toggleCamera}
      onShare={toggleShare}
      onHangUp={() => {
        navigator.vibrate?.(40); // a short tap on phones that can; ignored elsewhere
        engine.current?.hangUp();
      }}
    />
  );
}
