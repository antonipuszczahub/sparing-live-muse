import { useEffect, useState } from 'react';
import type { Lang } from '../../shared/types.ts';
import { t } from '../i18n/index.ts';
import { isNatural, pickVoice, pitchFor, previewVoice, saveVoice, savedVoice, sortVoices, voices } from '../lib/tts.ts';

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
 * Lets the user hear and choose the voice of the counterpart. The default is the best voice the browser
 * has, but "best available" can still be a robotic system voice, so the choice is theirs and it is remembered.
 */
export function VoicePicker({ lang, list }: { lang: Lang; list: SpeechSynthesisVoice[] }) {
  const [, bump] = useState(0);
  if (!list.length) return null;

  const row = (gender: 'm' | 'f') => {
    const pick = pickVoice(gender, lang);
    return (
      <div key={gender} className="flex flex-wrap items-center gap-2">
        <span className="w-36 text-sm text-[var(--muted)]">{t(gender === 'f' ? 'voiceWoman' : 'voiceMan')}</span>
        <select
          value={savedVoice(lang, gender) ?? ''}
          onChange={(e) => {
            saveVoice(lang, gender, e.target.value || null);
            bump((n) => n + 1);
          }}
          className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 py-1.5 text-sm"
        >
          <option value="">
            {t('voiceAuto')}
            {pick.voice ? ` → ${pick.voice.name}` : ''}
          </option>
          {list.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name}
              {isNatural(v) ? '' : ` (${t('voiceBasic')})`}
            </option>
          ))}
        </select>
        <button
          onClick={() => previewVoice(pick.voice, t('voiceSample'), lang, pitchFor(pick.matched, gender))}
          className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm hover:border-[#3a4160]"
        >
          {t('voicePreview')}
        </button>
      </div>
    );
  };

  return (
    <section className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="text-sm font-medium">{t('voiceTitle')}</div>
      <div className="mt-3 space-y-2">
        {row('f')}
        {row('m')}
      </div>
      {!list.some(isNatural) && <p className="mt-3 text-xs text-amber-400">{t('voiceRobotic')}</p>}
    </section>
  );
}
