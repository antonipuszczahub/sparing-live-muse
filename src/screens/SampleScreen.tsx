import { useEffect, useMemo, useRef, useState } from 'react';
import type { CallSnapshot } from '../engine/CallEngine.ts';
import { t, useLang } from '../i18n/index.ts';
import { useMoodTheme } from '../lib/useMoodTheme.ts';
import { SAMPLE_TRACE, sampleConfig, sampleResult, sampleTurns } from '../sample/data.ts';
import { CallView } from './CallView.tsx';
import { ReportView } from './ReportView.tsx';
import s from './Sample.module.css';

/** Milliseconds per word while a line is "spoken" or "typed", and the pause after each line. */
const WORD_MS = { bot: 95, user: 130 } as const;
const PAUSE_MS = 900;
const END_PAUSE_MS = 1600;

/**
 * A recorded call with an investor and the review after it, played back on the real call and review screens. It needs
 * no key and calls no model: the text is made up (src/sample/data.ts) and the portrait stays a photograph.
 */
export function SampleScreen({ onExit }: { onExit: () => void }) {
  const lang = useLang();
  const config = useMemo(() => sampleConfig(lang), [lang]);
  const turns = useMemo(() => sampleTurns(lang), [lang]);
  const result = useMemo(() => sampleResult(lang), [lang]);
  const [phase, setPhase] = useState<'call' | 'review'>('call');
  const [done, setDone] = useState(0); // lines already on the page
  const [words, setWords] = useState(0); // words of the current line shown so far
  const selfView = useRef<HTMLVideoElement>(null);

  const line = turns[done];
  const lastBot = [...turns.slice(0, done)].reverse().find((x) => x.role === 'bot');
  const mood = line?.role === 'bot' && line.mood && words > 0 ? line.mood : (lastBot?.mood ?? 3);
  useMoodTheme(phase === 'call' ? mood : null);

  useEffect(() => {
    if (phase !== 'call') return;
    if (!line) {
      const end = window.setTimeout(() => setPhase('review'), END_PAUSE_MS);
      return () => window.clearTimeout(end);
    }
    const total = line.text.split(/\s+/).length;
    const timer = window.setTimeout(
      () => {
        if (words < total) setWords(words + 1);
        else {
          setDone(done + 1);
          setWords(0);
        }
      },
      words >= total ? PAUSE_MS : words === 0 ? 350 : WORD_MS[line.role],
    );
    return () => window.clearTimeout(timer);
  }, [phase, line, words, done]);

  const shown = line ? line.text.split(/\s+/).slice(0, words).join(' ') : '';
  const last = turns[turns.length - 1]!;
  const snap: CallSnapshot = {
    state: phase === 'call' && line ? (line.role === 'bot' ? 'speaking' : 'listening') : 'ended',
    turns: turns.slice(0, done),
    liveBot: line?.role === 'bot' ? shown : '',
    liveUser: line?.role === 'user' ? shown : '',
    mood: mood as CallSnapshot['mood'],
    elapsedMs: line ? line.at : last.at,
    muted: false,
    turnTaking: false,
    lastLatencyMs: line ? undefined : 1100,
  };

  return (
    <>
      <div className={s.bar} role="status">
        <span className={s.tag}>
          <b />
          {phase === 'call' ? t('sampleTag') : t('sampleReviewNote')}
        </span>
        {phase === 'call' && (
          <button type="button" className={s.btn} onClick={() => setPhase('review')}>
            {t('sampleSkip')}
          </button>
        )}
        <button type="button" className={s.btn} onClick={onExit}>
          {t('sampleBack')}
        </button>
      </div>
      {phase === 'call' ? (
        <CallView
          sample
          session=""
          config={config}
          snap={snap}
          voiceName=""
          camOn={false}
          face={null}
          selfView={selfView}
          sharing={false}
          seen=""
          typed=""
          canCamera={false}
          canShare={false}
          onTyped={() => undefined}
          onSend={() => undefined}
          onMute={() => undefined}
          onCamera={() => undefined}
          onShare={() => undefined}
          onHangUp={() => setPhase('review')}
        />
      ) : (
        <ReportView
          sample
          session=""
          config={config}
          turns={turns}
          durationMs={last.at + 40000}
          hungUp={false}
          camera={[]}
          result={result}
          trace={SAMPLE_TRACE}
          error=""
          secs={0}
          onAgain={onExit}
          onRedial={onExit}
          onRetry={() => undefined}
        />
      )}
    </>
  );
}
