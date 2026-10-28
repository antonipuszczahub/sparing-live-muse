import { useEffect, useState } from 'react';
import { LEVELS, SCENARIOS, SCENARIO_IDS } from '../../shared/scenarios.ts';
import type { Level, ScenarioId, SessionConfig } from '../../shared/types.ts';
import { clearWeakSpots, topWeakSpots } from '../lib/memory.ts';
import { sttSupported } from '../lib/stt.ts';

const TWIN_EXAMPLE: Record<ScenarioId, string> = {
  sales: 'e.g. basecamp.com, or the website of the company you will call',
  defense: '',
  salary: 'e.g. the company you work for or are joining',
  pitch: 'e.g. the fund you are pitching, such as ycombinator.com',
};

interface Health {
  ok: boolean;
  keyConfigured: boolean;
  openWeights?: boolean;
  openHost?: string;
  openModel?: string;
  budget: { spentToday: number; dailyLimit: number };
}

export function SetupScreen({
  onStart,
  onTwin,
}: {
  onStart: (session: string, config: SessionConfig) => void;
  onTwin: (session: string, config: SessionConfig, company: string) => void;
}) {
  const [scenario, setScenario] = useState<ScenarioId>('sales');
  const [level, setLevel] = useState<Level>(2);
  const [topic, setTopic] = useState('');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const [weak, setWeak] = useState<string[]>(() => topWeakSpots(3));
  const [useMemory, setUseMemory] = useState(true);
  const [openWeights, setOpenWeights] = useState(false);
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
        body: JSON.stringify({ scenario, level, topic: topic.trim() || sc.topicExample, focus: useMemory ? weak : undefined, provider: openWeights ? 'open' : undefined }),
      });
      if (!r.ok) throw new Error('Could not start a session');
      const { session, config } = (await r.json()) as { session: string; config: SessionConfig };
      if (company.trim() && scenario !== 'defense') onTwin(session, config, company.trim());
      else onStart(session, config);
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

      {scenario !== 'defense' && (
        <section className="mt-6">
          <label className="text-sm text-[var(--muted)]">
            Rehearse with a real company <span className="text-xs">(optional, researched live on the web)</span>
          </label>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={TWIN_EXAMPLE[scenario]}
            className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 outline-none focus:border-[var(--accent)]"
          />
        </section>
      )}

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

      {weak.length > 0 && (
        <section className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Your recurring weak spots</div>
            <button
              onClick={() => {
                clearWeakSpots();
                setWeak([]);
              }}
              className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
            >
              Forget them
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {weak.map((w) => (
              <span key={w} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs">
                {w}
              </span>
            ))}
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[var(--muted)]">
            <input type="checkbox" checked={useMemory} onChange={(e) => setUseMemory(e.target.checked)} />
            Let the next character aim at these
          </label>
        </section>
      )}

      {health?.openWeights && (
        <section className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={openWeights} onChange={(e) => setOpenWeights(e.target.checked)} />
            <span>
              <span className="font-medium">Run the character on open weights</span>
              <span className="block text-[var(--muted)]">
                Open weights model {health.openModel}, served by {health.openHost}. Same call, same protocol. The post-call review, research and faces still use Meta's hosted models.
              </span>
            </span>
          </label>
        </section>
      )}

      {!sttSupported() &&<p className="mt-6 text-sm text-amber-400">Voice input needs Microsoft Edge or Google Chrome.</p>}
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
      <p className="mt-4 max-w-xl text-xs leading-relaxed text-[var(--muted)]">
        Privacy: your voice is relayed to Meta's speech model and your words go to Meta's Muse models. While free Meta credits are in use, Meta may use this content to improve its products. This app stores no audio or transcripts; it keeps only a cost log, and your weak spots stay in this browser.
      </p>
      {health && (
        <p className="mt-10 text-xs text-[var(--muted)]">
          Budget today: ${health.budget.spentToday.toFixed(2)} of ${health.budget.dailyLimit.toFixed(2)}
        </p>
      )}
    </main>
  );
}
