import { useEffect, useState } from 'react';
import { LEVELS, SCENARIOS, SCENARIO_IDS } from '../../shared/scenarios.ts';
import type { Level, ScenarioId, SessionConfig } from '../../shared/types.ts';
import { sttSupported } from '../lib/stt.ts';

interface Health {
  ok: boolean;
  keyConfigured: boolean;
  budget: { spentToday: number; dailyLimit: number };
}

export function SetupScreen({ onStart }: { onStart: (session: string, config: SessionConfig) => void }) {
  const [scenario, setScenario] = useState<ScenarioId>('sales');
  const [level, setLevel] = useState<Level>(2);
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const sc = SCENARIOS[scenario];

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  async function start() {
    setBusy(true);
    setError('');
    try {
      // Unlock audio and the microphone inside the click, so the browser lets the call speak.
      // Without a microphone the call still works: the user types instead of speaking.
      await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((s) => s.getTracks().forEach((t) => t.stop()))
        .catch(() => undefined);
      const r = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, level, topic: topic.trim() || sc.topicExample }),
      });
      if (!r.ok) throw new Error('Could not start a session');
      const { session, config } = (await r.json()) as { session: string; config: SessionConfig };
      onStart(session, config);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Sparing Live</h1>
        <p className="mt-1 text-[var(--muted)]">Rehearse the conversation you are afraid of. It talks back, interrupts, and can hang up.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {SCENARIO_IDS.map((id) => (
          <button
            key={id}
            onClick={() => setScenario(id)}
            className={`rounded-xl border p-4 text-left transition ${
              scenario === id ? 'border-[var(--accent)] bg-[var(--panel)]' : 'border-[var(--line)] hover:border-[#3a4160]'
            }`}
          >
            <div className="font-medium">{SCENARIOS[id].title}</div>
            <div className="mt-1 text-sm text-[var(--muted)]">{SCENARIOS[id].tagline}</div>
          </button>
        ))}
      </section>

      <section className="mt-6">
        <label className="text-sm text-[var(--muted)]">{sc.topicLabel}</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={sc.topicExample}
          className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 outline-none focus:border-[var(--accent)]"
        />
      </section>

      <section className="mt-6">
        <div className="text-sm text-[var(--muted)]">Difficulty</div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {([1, 2, 3, 4] as Level[]).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`rounded-lg border px-2 py-2 text-sm transition ${
                level === l ? 'border-[var(--accent)] bg-[var(--panel)]' : 'border-[var(--line)] hover:border-[#3a4160]'
              }`}
            >
              {LEVELS[l].name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">{LEVELS[level].blurb}</p>
      </section>

      {!sttSupported() && <p className="mt-6 text-sm text-amber-400">Voice input needs Microsoft Edge or Google Chrome.</p>}
      {health && !health.keyConfigured && <p className="mt-6 text-sm text-amber-400">MODEL_API_KEY is missing in .env, so the server cannot reach the Meta models yet.</p>}
      {error && <p className="mt-6 text-sm text-red-400">{error}</p>}

      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={start}
          disabled={busy}
          className="rounded-lg bg-[var(--accent)] px-5 py-2.5 font-medium text-black transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? 'Connecting…' : 'Start call'}
        </button>
        <span className="text-sm text-[var(--muted)]">Use headphones so the character does not hear itself.</span>
      </div>
      {health && (
        <p className="mt-10 text-xs text-[var(--muted)]">
          Budget today: ${health.budget.spentToday.toFixed(2)} of ${health.budget.dailyLimit.toFixed(2)}
        </p>
      )}
    </main>
  );
}
