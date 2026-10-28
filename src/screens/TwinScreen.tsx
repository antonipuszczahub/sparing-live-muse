import { useEffect, useRef, useState } from 'react';
import { applyTwin } from '../../shared/twin.ts';
import type { SessionConfig, TwinProfile } from '../../shared/types.ts';
import { t, useLang } from '../i18n/index.ts';
import { postSSE } from '../lib/sse.ts';

interface Step {
  kind: 'search' | 'open' | 'note';
  text: string;
}

const STEP_ICON = { search: '🔎', open: '📄', note: '💭' } as const;
const stepLabel = (kind: Step['kind']) => (kind === 'search' ? t('stepSearching') : kind === 'open' ? t('stepReading') : '');

export function TwinScreen({
  session,
  config,
  company,
  onReady,
  onSkip,
}: {
  session: string;
  config: SessionConfig;
  company: string;
  onReady: (config: SessionConfig) => void;
  onSkip: () => void;
}) {
  useLang();
  const [steps, setSteps] = useState<Step[]>([]);
  const [twin, setTwin] = useState<TwinProfile | null>(null);
  const [error, setError] = useState('');
  const [secs, setSecs] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const ac = new AbortController();
    postSSE(
      '/api/twin',
      { session, company, scenario: config.scenario, topic: config.topic, lang: config.lang, gender: config.persona.gender },
      (event, data) => {
        if (event === 'step') setSteps((s) => [...s, data as Step]);
        else if (event === 'twin') setTwin(data as TwinProfile);
        else if (event === 'error') {
          const d = data as { message: string; budget?: string };
          setError(d.budget ? t('budgetUsedUp') : d.message);
        }
      },
      ac.signal,
    ).catch((e) => !ac.signal.aborted && setError((e as Error).message));
    // Not aborted on unmount: StrictMode mounts twice in dev and the research must finish once.
  }, [session, company, config]);

  useEffect(() => {
    if (twin || error) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [twin, error]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t('twinTitle')}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {t('twinIntroA')}
        <span className="text-[var(--text)]">{company}</span>
        {t('twinIntroB')}
      </p>

      <ol className="mt-6 space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 text-sm">
            <span>{STEP_ICON[s.kind]}</span>
            <span className={s.kind === 'note' ? 'italic text-[var(--muted)]' : ''}>
              {stepLabel(s.kind) && <span className="text-[var(--muted)]">{stepLabel(s.kind)} </span>}
              <span className="break-all">{s.text}</span>
            </span>
          </li>
        ))}
        {!twin && !error && (
          <li className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--muted)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" /> {t('working', secs)}
          </li>
        )}
      </ol>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/40 p-4">
          <p className="text-red-300">{error}</p>
          <button onClick={onSkip} className="mt-3 rounded-lg border border-[var(--line)] px-4 py-2 text-sm hover:border-[#3a4160]">
            {t('continueGeneric')}
          </button>
        </div>
      )}

      {twin && (
        <section className="mt-8 rounded-2xl border border-[var(--accent)] bg-[var(--panel)] p-5">
          <div className="text-xs uppercase tracking-wide text-[var(--accent)]">{t('twinReady')}</div>
          <h2 className="mt-1 text-xl font-medium">{twin.company}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{twin.summary}</p>
          <div className="mt-4 text-sm">
            <span className="text-[var(--muted)]">{t('youWillTalk')}</span>
            <span className="font-medium">{twin.buyerRole}</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{twin.buyerBio}</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-sm font-medium">{t('whatHurts')}</div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                {twin.pains.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium">{t('expectHear')}</div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                {twin.objections.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          </div>

          {twin.sources.length > 0 && (
            <div className="mt-4 text-xs text-[var(--muted)]">
              {t('sourcesRead')}{' '}
              {twin.sources.map((u, i) => (
                <span key={u}>
                  {i > 0 && ' · '}
                  {new URL(u).hostname.replace(/^www\./, '')}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={() => onReady(applyTwin(config, twin))}
            className="mt-6 rounded-lg bg-[var(--accent)] px-5 py-2.5 font-medium text-black hover:brightness-110"
          >
            {t('callThem')}
          </button>
        </section>
      )}
    </main>
  );
}
