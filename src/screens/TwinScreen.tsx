import { useEffect, useRef, useState } from 'react';
import { applyTwin } from '../../shared/twin.ts';
import type { SessionConfig, TwinProfile } from '../../shared/types.ts';
import { t, useLang } from '../i18n/index.ts';
import { postSSE } from '../lib/sse.ts';
import { TwinView, type Step } from './TwinView.tsx';

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
        if (event === 'step') setSteps((st) => [...st, data as Step]);
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
    const id = setInterval(() => setSecs((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [twin, error]);

  return <TwinView company={company} steps={steps} twin={twin} error={error} secs={secs} onReady={(profile) => onReady(applyTwin(config, profile))} onSkip={onSkip} />;
}
