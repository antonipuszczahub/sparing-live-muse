import { useEffect, useState } from 'react';
import type { AuditResult } from '../../shared/audit.ts';
import type { FramingEvent } from '../../shared/framing.ts';
import { langOf } from '../../shared/lang.ts';
import type { TraceRow } from '../../shared/trace.ts';
import type { SessionConfig, Turn } from '../../shared/types.ts';
import { t, useLang } from '../i18n/index.ts';
import { ApiError, requestAudit, requestTrace } from '../lib/api.ts';
import { recordRun } from '../lib/history.ts';
import { recordWeakSpots } from '../lib/memory.ts';
import { ReportView } from './ReportView.tsx';

/** Asks for the review of the call and shows it as it arrives. */
export function ReportScreen({
  session,
  config,
  turns,
  durationMs,
  hungUp,
  camera,
  onAgain,
}: {
  session: string;
  config: SessionConfig;
  turns: Turn[];
  durationMs: number;
  hungUp: boolean;
  camera: FramingEvent[];
  onAgain: () => void;
}) {
  useLang();
  const lang = langOf(config);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState('');
  const [trace, setTrace] = useState<TraceRow[]>([]);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    let live = true;
    requestAudit({ session, config, turns, durationMs, hungUp, camera })
      .then((r) => {
        if (!live) return;
        recordWeakSpots(r.weaknessTags, lang);
        recordRun({ t: Date.now(), score: r.score, scenario: config.scenario, level: config.level }, lang);
        setResult(r);
        // the review is the last call of the session, so the ledger is complete now
        void requestTrace(session).then((rows) => live && setTrace(rows));
      })
      .catch((e) => live && setError(e instanceof ApiError && e.budget ? t('budgetUsedUp') : (e as Error).message));
    return () => {
      live = false;
    };
  }, [session, config, turns, durationMs, hungUp, camera, lang]);

  useEffect(() => {
    if (result || error) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [result, error]);

  return <ReportView session={session} config={config} turns={turns} durationMs={durationMs} hungUp={hungUp} camera={camera} result={result} trace={trace} error={error} secs={secs} onAgain={onAgain} />;
}
