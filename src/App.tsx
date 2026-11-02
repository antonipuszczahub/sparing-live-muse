import { useCallback, useEffect, useRef, useState } from 'react';
import type { FramingEvent } from '../shared/framing.ts';
import type { SessionConfig, Turn } from '../shared/types.ts';
import styles from './App.module.css';
import { Backdrop, pulseBackdrop } from './components/Backdrop.tsx';

import { CallScreen } from './screens/CallScreen.tsx';
import { ReportScreen } from './screens/ReportScreen.tsx';
import { SetupScreen } from './screens/SetupScreen.tsx';
import { TwinScreen } from './screens/TwinScreen.tsx';

type View =
  | { name: 'setup' }
  | { name: 'twin'; session: string; config: SessionConfig; company: string }
  | { name: 'call'; session: string; config: SessionConfig }
  | { name: 'done'; session: string; config: SessionConfig; turns: Turn[]; durationMs: number; hungUp: boolean; camera: FramingEvent[] };

const LEAVE_MS = 380;

export function App() {
  const [view, setView] = useState<View>({ name: 'setup' });
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(0);

  /** Leaving a screen: it recedes while the light flares behind it, then the next screen rises. */
  const go = useCallback((next: View) => {
    window.clearTimeout(timer.current);
    pulseBackdrop();
    setLeaving(true);
    timer.current = window.setTimeout(() => {
      setView(next);
      setLeaving(false);
      window.scrollTo(0, 0);
    }, LEAVE_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  let screen;
  if (view.name === 'setup') {
    screen = (
      <SetupScreen
        onStart={(session, config) => go({ name: 'call', session, config })}
        onTwin={(session, config, company) => go({ name: 'twin', session, config, company })}
      />
    );
  } else if (view.name === 'twin') {
    screen = (
      <TwinScreen
        session={view.session}
        config={view.config}
        company={view.company}
        onReady={(config) => go({ name: 'call', session: view.session, config })}
        onSkip={() => go({ name: 'call', session: view.session, config: view.config })}
      />
    );
  } else if (view.name === 'call') {
    screen = (
      <CallScreen
        key={view.session}
        session={view.session}
        config={view.config}
        onEnd={(turns, durationMs, hungUp, camera) => go({ name: 'done', session: view.session, config: view.config, turns, durationMs, hungUp, camera })}
      />
    );
  } else {
    screen = (
      <ReportScreen
        key={view.session}
        session={view.session}
        config={view.config}
        turns={view.turns}
        durationMs={view.durationMs}
        hungUp={view.hungUp}
        camera={view.camera}
        onAgain={() => go({ name: 'setup' })}
      />
    );
  }

  return (
    <>
      <Backdrop />
      <div key={view.name} className={`${styles.screen} ${leaving ? styles.leaving : ''}`}>
        {screen}
      </div>
    </>
  );
}
