import { useState } from 'react';
import type { FramingEvent } from '../shared/framing.ts';
import type { SessionConfig, Turn } from '../shared/types.ts';
import { CallScreen } from './screens/CallScreen.tsx';
import { ReportScreen } from './screens/ReportScreen.tsx';
import { TwinScreen } from './screens/TwinScreen.tsx';
import { SetupScreen } from './screens/SetupScreen.tsx';

type View =
  | { name: 'setup' }
  | { name: 'twin'; session: string; config: SessionConfig; company: string }
  | { name: 'call'; session: string; config: SessionConfig }
  | { name: 'done'; session: string; config: SessionConfig; turns: Turn[]; durationMs: number; hungUp: boolean; camera: FramingEvent[] };

export function App() {
  const [view, setView] = useState<View>({ name: 'setup' });

  if (view.name === 'setup') {
    return (
      <SetupScreen
        onStart={(session, config) => setView({ name: 'call', session, config })}
        onTwin={(session, config, company) => setView({ name: 'twin', session, config, company })}
      />
    );
  }
  if (view.name === 'twin') {
    return (
      <TwinScreen
        session={view.session}
        config={view.config}
        company={view.company}
        onReady={(config) => setView({ name: 'call', session: view.session, config })}
        onSkip={() => setView({ name: 'call', session: view.session, config: view.config })}
      />
    );
  }
  if (view.name === 'call') {
    return (
      <CallScreen
        key={view.session}
        session={view.session}
        config={view.config}
        onEnd={(turns, durationMs, hungUp, camera) => setView({ name: 'done', session: view.session, config: view.config, turns, durationMs, hungUp, camera })}
      />
    );
  }
  return (
    <ReportScreen
      key={view.session}
      session={view.session}
      config={view.config}
      turns={view.turns}
      durationMs={view.durationMs}
      hungUp={view.hungUp}
      camera={view.camera}
      onAgain={() => setView({ name: 'setup' })}
    />
  );
}
