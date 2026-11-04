import { useEffect, useRef, useState } from 'react';
import type { FaceBox, FramingEvent } from '../../shared/framing.ts';
import type { SessionConfig, Turn } from '../../shared/types.ts';
import { langOf } from '../../shared/lang.ts';
import { CallEngine, type CallSnapshot } from '../engine/CallEngine.ts';
import { useLang } from '../i18n/index.ts';
import { CameraWatch } from '../lib/camera.ts';
import { getPtt, TalkGate } from '../lib/ptt.ts';
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

  // Push to talk (off unless chosen in the voice sheet): the microphone is muted until Space or the button is held.
  const [pttOn] = useState(getPtt);
  const gate = useRef<TalkGate | null>(null);
  useEffect(() => {
    if (!pttOn) return;
    // Holding the key (or the button) also opens the microphone while the character speaks, if the call is taking turns.
    const g = new TalkGate((m) => {
      if (!m) engine.current?.cutIn(true);
      engine.current?.setMuted(m);
      if (m) engine.current?.cutIn(false);
    });
    gate.current = g;
    g.start();
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable));
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
      e.preventDefault(); // a focused button must not be clicked by the same key
      if (!e.repeat) g.press();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || typing(e)) return;
      e.preventDefault();
      g.release();
    };
    const blur = () => g.release(); // a key held while the window loses focus would never be let go
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      g.dispose();
      gate.current = null;
    };
  }, [pttOn, config, session]);

  // Taking turns (the character heard itself, so the microphone is closed while it speaks): Space held opens it to cut in.
  const takingTurns = useRef(false);
  takingTurns.current = Boolean(snap?.turnTaking);
  useEffect(() => {
    if (pttOn) return; // push to talk already works this way
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable));
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey || typing(e) || !takingTurns.current) return;
      e.preventDefault(); // a focused button must not be clicked by the same key
      engine.current?.cutIn(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (takingTurns.current && !typing(e)) e.preventDefault();
      engine.current?.cutIn(false);
    };
    const blur = () => engine.current?.cutIn(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [pttOn, config, session]);

  // M mutes and unmutes the microphone, unless a text field has the keyboard (not in push to talk)
  const mutedNow = useRef(false);
  mutedNow.current = Boolean(snap?.muted);
  useEffect(() => {
    if (pttOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'm' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      engine.current?.setMuted(!mutedNow.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pttOn]);

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
      ptt={pttOn ? { onTalk: (down) => (down ? gate.current?.press() : gate.current?.release()) } : undefined}
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
