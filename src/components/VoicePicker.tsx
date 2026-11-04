import { useEffect, useState } from 'react';
import type { Lang } from '../../shared/types.ts';
import { t } from '../i18n/index.ts';
import { isNatural, pickVoice, pitchFor, previewVoice, saveVoice, savedVoice, sortVoices, voices, voicesFor } from '../lib/tts.ts';
import ui from './ui.module.css';
import styles from './VoicePicker.module.css';

/** The voices of a language, kept current: browsers load them late, and Edge adds its Natural voices after a moment. */
export function useVoiceList(lang: Lang) {
  const [state, setState] = useState<{ list: SpeechSynthesisVoice[]; total: number }>({ list: [], total: 0 });
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    const read = () => setState({ list: sortVoices(voices(lang)), total: speechSynthesis.getVoices().length });
    read();
    speechSynthesis.addEventListener('voiceschanged', read);
    return () => speechSynthesis.removeEventListener('voiceschanged', read);
  }, [lang]);
  return state;
}

/**
 * Lets the user hear and choose the voice of the counterpart: the browser's own voices, filtered by the
 * character's gender, with Edge's Natural voices first.
 */
export function VoicePicker({ lang, list }: { lang: Lang; list: SpeechSynthesisVoice[] }) {
  const [, bump] = useState(0);
  if (!list.length) return null;

  const row = (gender: 'm' | 'f') => {
    const pick = pickVoice(gender, lang);
    return (
      <div key={gender} className={styles.row}>
        <span className={styles.who}>{t(gender === 'f' ? 'voiceWoman' : 'voiceMan')}</span>
        <select
          value={savedVoice(lang, gender) ?? ''}
          onChange={(e) => {
            saveVoice(lang, gender, e.target.value || null);
            bump((n) => n + 1);
          }}
          className={styles.select}
          aria-label={t(gender === 'f' ? 'voiceWoman' : 'voiceMan')}
        >
          <option value="">
            {t('voiceAuto')}
            {pick.voice ? ` → ${pick.voice.name}` : ''}
          </option>
          {voicesFor(list, lang, gender).map((v) => (
            <option key={v.name} value={v.name}>
              {v.name}
              {isNatural(v) ? '' : ` (${t('voiceBasic')})`}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => previewVoice(pick.voice, t('voiceSample'), lang, pitchFor(pick.matched, gender))} className={ui.btn}>
          {t('voicePreview')}
        </button>
      </div>
    );
  };

  return (
    <section className={styles.wrap}>
      <div className={styles.rows}>{(['f', 'm'] as const).map(row)}</div>
      {!list.some(isNatural) && <p className={`${styles.small} ${styles.warn}`}>{t('voiceRobotic')}</p>}
    </section>
  );
}
