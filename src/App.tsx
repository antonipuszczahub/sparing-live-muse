import { useState } from 'react';
import type { SessionConfig, Turn } from '../shared/types.ts';
import { CallScreen } from './screens/CallScreen.tsx';
import { SetupScreen } from './screens/SetupScreen.tsx';

type View =
  | { name: 'setup' }
  | { name: 'call'; session: string; config: SessionConfig }
  | { name: 'done'; session: string; config: SessionConfig; turns: Turn[]; durationMs: number };

export function App() {
  const [view, setView] = useState<View>({ name: 'setup' });

  if (view.name === 'setup') {
    return <SetupScreen onStart={(session, config) => setView({ name: 'call', session, config })} />;
  }
  if (view.name === 'call') {
    return (
      <CallScreen
        key={view.session}
        session={view.session}
        config={view.config}
        onEnd={(turns, durationMs) => setView({ name: 'done', session: view.session, config: view.config, turns, durationMs })}
      />
    );
  }
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Call ended</h1>
      <p className="mt-2 text-[var(--muted)]">{view.turns.length} turns, {Math.round(view.durationMs / 1000)} s. The audit comes next.</p>
      <button className="mt-6 rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-black" onClick={() => setView({ name: 'setup' })}>
        New call
      </button>
    </main>
  );
}
