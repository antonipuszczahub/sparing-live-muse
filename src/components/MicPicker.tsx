import { useCallback, useEffect, useState } from 'react';
import { t } from '../i18n/index.ts';
import { listMics, looksVirtual, saveMic, savedMic, type Mic } from '../lib/mic.ts';
import ui from './ui.module.css';
import styles from './VoicePicker.module.css';

/**
 * Lets the user pick the microphone the call listens to. With a virtual mixer (Voicemeeter, a virtual cable) the
 * browser's default input can carry the speakers' sound, so the character would hear only itself; the real headset
 * microphone is chosen here instead. Names appear only after the microphone has been allowed once.
 */
export function MicPicker() {
  const [mics, setMics] = useState<Mic[]>([]);
  const [chosen, setChosen] = useState<string | null>(savedMic);
  const refresh = useCallback(() => void listMics().then(setMics), []);

  useEffect(() => {
    refresh();
    const md = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
    md?.addEventListener?.('devicechange', refresh);
    return () => md?.removeEventListener?.('devicechange', refresh);
  }, [refresh]);

  const named = mics.some((m) => m.label);
  // the entry the browser calls "default" says which device is the default; "communications" is the same device again
  const shown = mics.filter((m) => m.id !== 'communications');
  const current = chosen ? shown.find((m) => m.id === chosen) : (shown.find((m) => m.id === 'default') ?? shown[0]);
  const virtual = Boolean(current?.label && looksVirtual(current.label));

  async function allow() {
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: true });
      st.getTracks().forEach((tr) => tr.stop());
    } catch {
      /* refused: the list stays unnamed */
    }
    refresh();
  }

  if (!mics.length) return null;
  return (
    <section className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.who}>{t('micTitle')}</span>
        {named ? (
          <select
            value={chosen && shown.some((m) => m.id === chosen) ? chosen : ''}
            onChange={(e) => {
              const id = e.target.value || null;
              saveMic(id);
              setChosen(id);
            }}
            className={styles.select}
            aria-label={t('micTitle')}
          >
            <option value="">{t('micAuto')}</option>
            {shown
              .filter((m) => m.id !== 'default')
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label || m.id}
                </option>
              ))}
          </select>
        ) : (
          <button type="button" onClick={allow} className={ui.btn}>
            {t('micAllow')}
          </button>
        )}
      </div>
      {virtual && <p className={`${styles.small} ${styles.warn}`}>{t('micVirtual', current!.label)}</p>}
    </section>
  );
}
