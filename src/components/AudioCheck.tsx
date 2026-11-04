import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang } from '../../shared/types.ts';
import { t } from '../i18n/index.ts';
import { defaultOutput, runAudioCheck, type OutputInfo, type Phase, type Verdict } from '../lib/audioCheck.ts';
import { listMics, savedMic } from '../lib/mic.ts';
import { pickVoice, pitchFor, sayOnce } from '../lib/tts.ts';
import ui from './ui.module.css';
import styles from './AudioCheck.module.css';

const KIND_KEY = { headphones: 'audioKindHeadphones', speakers: 'audioKindSpeakers', virtual: 'audioKindVirtual', unknown: 'audioKindUnknown' } as const;
const PHASE_KEY = { room: 'audioPhaseRoom', speak: 'audioPhaseSpeak', sample: 'audioPhaseSample' } as const;

/**
 * Shows which microphone and output the call will use, guesses from the output's name whether it is headphones, and
 * runs a short test with the real microphone: does it hear the user, and does it hear the character's own voice
 * (speakers leaking into the microphone), which would make the call talk to itself.
 */
export function AudioCheck({ lang }: { lang: Lang }) {
  const [mic, setMic] = useState('');
  const [out, setOut] = useState<OutputInfo | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [failed, setFailed] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const running = phase !== null && phase !== 'done';

  const refresh = useCallback(async () => {
    const mics = await listMics();
    const chosen = savedMic();
    const current = (chosen ? mics.find((m) => m.id === chosen) : (mics.find((m) => m.id === 'default') ?? mics[0])) ?? null;
    setMic((current?.label ?? '').replace(/^default\s*-\s*/i, ''));
    setOut(await defaultOutput());
  }, []);

  useEffect(() => {
    void refresh();
    const md = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
    md?.addEventListener?.('devicechange', refresh);
    return () => md?.removeEventListener?.('devicechange', refresh);
  }, [refresh]);

  async function run() {
    setVerdict(null);
    setFailed(false);
    setPhase('room');
    try {
      const pick = pickVoice('f', lang);
      const result = await runAudioCheck({
        speakSample: () => sayOnce(t('voiceSample'), pick.voice, lang, pitchFor(pick.matched, 'f')),
        onPhase: setPhase,
        onLevel: (l) => {
          if (bar.current) bar.current.style.width = `${Math.round(l * 100)}%`;
        },
      });
      setVerdict(result);
    } catch {
      setFailed(true);
      setPhase(null);
    }
    void refresh(); // names appear once the microphone has been allowed
  }

  const speakers = out?.kind === 'speakers';
  return (
    <section className={styles.wrap}>
      <h3 className={styles.title}>{t('audioTitle')}</h3>
      <p className={styles.line}>
        {t('audioMic')}: <b>{mic || t('audioUnnamed')}</b>
      </p>
      <p className={styles.line}>
        {t('audioOut')}: <b>{out ? out.label : t('audioUnnamed')}</b>
        {out && (
          <>
            {' · '}
            <span className={speakers || out.kind === 'virtual' ? styles.warn : undefined}>{t(KIND_KEY[out.kind])}</span>
          </>
        )}
      </p>
      {speakers && <p className={`${styles.line} ${styles.warn}`}>{t('audioSpeakersHint')}</p>}
      <div>
        <button type="button" className={ui.btn} onClick={run} disabled={running}>
          {t('audioRun')}
        </button>
      </div>
      {phase && phase !== 'done' && <p className={styles.phase}>{t(PHASE_KEY[phase])}</p>}
      {phase && (
        <div className={styles.meter} aria-hidden="true">
          <div ref={bar} className={styles.bar} />
        </div>
      )}
      {failed && <p className={styles.bad}>{t('audioNoMic')}</p>}
      {verdict && (
        <div className={styles.results} aria-live="polite">
          <p className={verdict.voice ? styles.good : styles.bad}>{verdict.voice ? t('audioHeardYou') : t('audioNoVoice')}</p>
          <p className={verdict.echo ? styles.bad : styles.good}>{verdict.echo ? t('audioEcho') : t('audioNoEcho')}</p>
        </div>
      )}
    </section>
  );
}
