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

/** The reviews already asked for, by session and attempt, and the ones already written into the history. */
const audits = new Map<string, Promise<AuditResult>>();
const recorded = new Set<string>();

/** Asks for the review of the call and shows it as it arrives. */
export function ReportScreen({
  session,
  config,
  turns,
  durationMs,
  hungUp,
  camera,
  onAgain,
  onRedial,
}: {
  session: string;
  config: SessionConfig;
  turns: Turn[];
  durationMs: number;
  hungUp: boolean;
  camera: FramingEvent[];
  onAgain: () => void;
  onRedial: () => void;
}) {
  useLang();
  const lang = langOf(config);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState('');
  const [trace, setTrace] = useState<TraceRow[]>([]);
  const [secs, setSecs] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    // One review per session and attempt: React mounts effects twice in development, and a parent that hands over a new
    // array would start another run. Each extra run is a paid Wonder call of about fifteen seconds.
    const key = `${session}:${attempt}`;
    let asked = audits.get(key);
    if (!asked) {
      asked = requestAudit({ session, config, turns, durationMs, hungUp, camera });
      audits.set(key, asked);
      asked.catch(() => audits.delete(key));
    }
    asked
      .then((r) => {
        if (!live) return;
        if (!recorded.has(key)) {
          recorded.add(key);
          recordWeakSpots(r.weaknessTags, lang);
          recordRun({ t: Date.now(), score: r.score, scenario: config.scenario, level: config.level }, lang);
        }
        setResult(r);
        // the review is the last call of the session, so the ledger is complete now
        void requestTrace(session).then((rows) => live && setTrace(rows));
      })
      .catch((e) => live && setError(e instanceof ApiError && e.budget ? t('budgetUsedUp') : (e as Error).message));
    return () => {
      live = false;
    };
  }, [session, config, turns, durationMs, hungUp, camera, lang, attempt]);

  useEffect(() => {
    if (result || error) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [result, error]);

  return <ReportView session={session} config={config} turns={turns} durationMs={durationMs} hungUp={hungUp} camera={camera} result={result} trace={trace} error={error} secs={secs} onAgain={onAgain} onRedial={onRedial} onRetry={() => {
    setError('');
    setSecs(0);
    setAttempt((n) => n + 1);
  }} />;
}
