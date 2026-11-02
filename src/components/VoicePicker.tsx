import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../../shared/types.ts';
import { t } from '../i18n/index.ts';
import type { CloudSpeaker } from '../lib/cloudSpeaker.ts';
import {
  cloudAvailable,
  cloudCatalog,
  getSource,
  previewCloud,
  saveCloudVoice,
  savedCloudVoice,
  setSource,
  voicesForGender,
  type CloudCatalog,
  type VoiceSource,
} from '../lib/cloudVoice.ts';
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
 * Lets the user hear and choose the voice of the counterpart. With an ElevenLabs key on the server the cloud
 * voices are offered first; otherwise (or by choice) the browser's own voices, filtered by the character's gender.
 */
export function VoicePicker({ lang, list }: { lang: Lang; list: SpeechSynthesisVoice[] }) {
  const [, bump] = useState(0);
  const [cloud, setCloud] = useState<{ model: string } | null>(null);
  const [catalog, setCatalog] = useState<CloudCatalog | null>(null);
  const [source, setSourceState] = useState<VoiceSource>(getSource);
  const preview = useRef<CloudSpeaker | null>(null);

  useEffect(() => {
    void cloudAvailable().then(setCloud);
  }, []);
  useEffect(() => {
    if (cloud) void cloudCatalog(lang).then(setCatalog);
  }, [cloud, lang]);
  useEffect(() => () => preview.current?.dispose(), []);

  const useCloud = Boolean(cloud && catalog && source === 'cloud');
  if (!list.length && !useCloud) return null;

  const cloudRow = (gender: 'm' | 'f') => {
    const options = voicesForGender(catalog!.voices, gender);
    const saved = savedCloudVoice(lang, gender);
    const effective = saved && options.some((v) => v.id === saved) ? saved : catalog!.defaults[gender];
    const pool = (catalog!.pool?.[gender] ?? []).map((id) => options.find((v) => v.id === id)?.name.split(' ')[0]).filter(Boolean);
    return (
      <div key={gender} className={styles.row}>
        <span className={styles.who}>{t(gender === 'f' ? 'voiceWoman' : 'voiceMan')}</span>
        <select
          value={saved ?? ''}
          onChange={(e) => {
            saveCloudVoice(lang, gender, e.target.value || null);
            bump((n) => n + 1);
          }}
          className={styles.select}
          aria-label={t(gender === 'f' ? 'voiceWoman' : 'voiceMan')}
        >
          <option value="">
            {t('voiceAuto')}
            {pool.length > 1 ? ` → ${pool.join(', ')}` : effective ? ` → ${options.find((v) => v.id === effective)?.name ?? ''}` : ''}
          </option>
          {options.map((v) => (
            <option key={v.id} value={v.id} disabled={v.locked}>
              {v.name}
              {v.accent ? ` · ${v.accent}` : ''}
              {v.locked ? ` (${t('voicePaid')})` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!effective}
          onClick={() => {
            preview.current?.dispose();
            if (effective) preview.current = previewCloud(effective, t('voiceSample'), lang);
          }}
          className={ui.btn}
        >
          {t('voicePreview')}
        </button>
      </div>
    );
  };

  const browserRow = (gender: 'm' | 'f') => {
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
      {cloud && catalog && (
        <div className={styles.head}>
          <div role="group" className={ui.seg}>
            {(['cloud', 'browser'] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={source === s}
                onClick={() => {
                  setSource(s);
                  setSourceState(s);
                }}
              >
                {t(s === 'cloud' ? 'voiceSourceCloud' : 'voiceSourceBrowser')}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={styles.rows}>{(['f', 'm'] as const).map((g) => (useCloud ? cloudRow(g) : browserRow(g)))}</div>
      {useCloud && <p className={styles.small}>{t('voiceCloudNote')}</p>}
      {!useCloud && !list.some(isNatural) && <p className={`${styles.small} ${styles.warn}`}>{t('voiceRobotic')}</p>}
    </section>
  );
}
