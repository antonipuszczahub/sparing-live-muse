import { useEffect, useState } from 'react';
import { LANG_META, LANGS } from '../../shared/lang.ts';
import { levelDef, scenarioDef, SCENARIO_IDS } from '../../shared/scenarios.ts';
import type { Level, ScenarioId, SessionConfig } from '../../shared/types.ts';
import { setLang, t, useLang } from '../i18n/index.ts';
import { clearWeakSpots, topWeakSpots } from '../lib/memory.ts';
import { loadUser, saveUser, type UserProfile } from '../lib/profile.ts';
import { sttSupported } from '../lib/stt.ts';
import { voices } from '../lib/tts.ts';

interface Health {
  ok: boolean;
  keyConfigured: boolean;
  openWeights?: boolean;
  openHost?: string;
  openModel?: string;
  budget: { spentToday: number; dailyLimit: number };
}

const SEGMENT = (on: boolean) =>
  `rounded-lg border px-3 py-1.5 text-sm transition ${on ? 'border-[var(--accent)] bg-[var(--panel)]' : 'border-[var(--line)] hover:border-[#3a4160]'}`;

/** True once the browser has loaded its voices and none of them speaks the language. */
function useMissingVoice(lang: 'en' | 'pl') {
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    const check = () => setMissing(speechSynthesis.getVoices().length > 0 && voices(lang).length === 0);
    check();
    speechSynthesis.addEventListener('voiceschanged', check);
    return () => speechSynthesis.removeEventListener('voiceschanged', check);
  }, [lang]);
  return missing;
}

export function SetupScreen({
  onStart,
  onTwin,
}: {
  onStart: (session: string, config: SessionConfig) => void;
  onTwin: (session: string, config: SessionConfig, company: string) => void;
}) {
  const lang = useLang();
  const [scenario, setScenario] = useState<ScenarioId>('sales');
  const [level, setLevel] = useState<Level>(2);
  const [topic, setTopic] = useState('');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const [weak, setWeak] = useState<string[]>(() => topWeakSpots(3, lang));
  const [useMemory, setUseMemory] = useState(true);
  const [openWeights, setOpenWeights] = useState(false);
  const [user, setUser] = useState<UserProfile>(loadUser);
  const missingVoice = useMissingVoice(lang);
  const sc = scenarioDef(scenario, lang);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  // Weak spots are kept per language, so switching language shows that language's list.
  useEffect(() => setWeak(topWeakSpots(3, lang)), [lang]);

  function changeUser(next: UserProfile) {
    setUser(next);
    saveUser(next);
  }

  async function start() {
    setBusy(true);
    setError('');
    try {
      // Unlock audio and the microphone inside the click, so the browser lets the call speak.
      // Without a microphone the call still works: the user types instead of speaking.
      await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((s) => s.getTracks().forEach((t) => t.stop()))
        .catch(() => undefined);
      const r = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario,
          level,
          topic: topic.trim() || sc.topicExample,
          focus: useMemory && weak.length ? weak : undefined,
          provider: openWeights ? 'open' : undefined,
          lang,
          user: lang === 'pl' ? user : undefined,
        }),
      });
      if (!r.ok) throw new Error(t('sessionFailed'));
      const { session, config } = (await r.json()) as { session: string; config: SessionConfig };
      if (company.trim() && scenario !== 'defense') onTwin(session, config, company.trim());
      else onStart(session, config);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('somethingWrong'));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Sparing Live</h1>
          <p className="mt-1 text-[var(--muted)]">{t('tagline')}</p>
        </div>
        <div role="group" aria-label={t('languageLabel')} className="flex shrink-0 gap-1">
          {LANGS.map((l) => (
            <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={SEGMENT(lang === l)}>
              {LANG_META[l].name}
            </button>
          ))}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {SCENARIO_IDS.map((id) => (
          <button
            key={id}
            onClick={() => setScenario(id)}
            className={`rounded-xl border p-4 text-left transition ${
              scenario === id ? 'border-[var(--accent)] bg-[var(--panel)]' : 'border-[var(--line)] hover:border-[#3a4160]'
            }`}
          >
            <div className="font-medium">{scenarioDef(id, lang).title}</div>
            <div className="mt-1 text-sm text-[var(--muted)]">{scenarioDef(id, lang).tagline}</div>
          </button>
        ))}
      </section>

      <section className="mt-6">
        <label className="text-sm text-[var(--muted)]">{sc.topicLabel}</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={sc.topicExample}
          className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 outline-none focus:border-[var(--accent)]"
        />
      </section>

      {scenario !== 'defense' && (
        <section className="mt-6">
          <label className="text-sm text-[var(--muted)]">
            {t('twinLabel')} <span className="text-xs">{t('twinOptional')}</span>
          </label>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={sc.twinExample}
            className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 outline-none focus:border-[var(--accent)]"
          />
        </section>
      )}

      <section className="mt-6">
        <div className="text-sm text-[var(--muted)]">{t('difficulty')}</div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {([1, 2, 3, 4] as Level[]).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`rounded-lg border px-2 py-2 text-sm transition ${
                level === l ? 'border-[var(--accent)] bg-[var(--panel)]' : 'border-[var(--line)] hover:border-[#3a4160]'
              }`}
            >
              {levelDef(l, lang).name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">{levelDef(level, lang).blurb}</p>
      </section>

      {lang === 'pl' && (
        <section className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="text-sm font-medium">{t('userTitle')}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--muted)]">{t('userGender')}</span>
            <button onClick={() => changeUser({ ...user, gender: 'm' })} aria-pressed={user.gender === 'm'} className={SEGMENT(user.gender === 'm')}>
              {t('userMan')}
            </button>
            <button onClick={() => changeUser({ ...user, gender: 'f' })} aria-pressed={user.gender === 'f'} className={SEGMENT(user.gender === 'f')}>
              {t('userWoman')}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--muted)]">{t('userForm')}</span>
            <button onClick={() => changeUser({ ...user, formal: true })} aria-pressed={user.formal} className={SEGMENT(user.formal)}>
              {t('userFormal')}
            </button>
            <button onClick={() => changeUser({ ...user, formal: false })} aria-pressed={!user.formal} className={SEGMENT(!user.formal)}>
              {t('userInformal')}
            </button>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">{t('userWhy')}</p>
        </section>
      )}

      {weak.length > 0 && (
        <section className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{t('weakTitle')}</div>
            <button
              onClick={() => {
                clearWeakSpots(lang);
                setWeak([]);
              }}
              className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
            >
              {t('weakForget')}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {weak.map((w) => (
              <span key={w} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs">
                {w}
              </span>
            ))}
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[var(--muted)]">
            <input type="checkbox" checked={useMemory} onChange={(e) => setUseMemory(e.target.checked)} />
            {t('weakUse')}
          </label>
        </section>
      )}

      {health?.openWeights && (
        <section className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={openWeights} onChange={(e) => setOpenWeights(e.target.checked)} />
            <span>
              <span className="font-medium">{t('openTitle')}</span>
              <span className="block text-[var(--muted)]">{t('openBody', health.openModel ?? '', health.openHost ?? '')}</span>
            </span>
          </label>
        </section>
      )}

      {!sttSupported() && <p className="mt-6 text-sm text-amber-400">{t('needsEdge')}</p>}
      {missingVoice && <p className="mt-6 text-sm text-amber-400">{t('noVoice')}</p>}
      {health && !health.keyConfigured && <p className="mt-6 text-sm text-amber-400">{t('keyMissing')}</p>}
      {error && <p className="mt-6 text-sm text-red-400">{error}</p>}

      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={start}
          disabled={busy}
          className="rounded-lg bg-[var(--accent)] px-5 py-2.5 font-medium text-black transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? t('connecting') : t('startCall')}
        </button>
        <span className="text-sm text-[var(--muted)]">{t('headphones')}</span>
      </div>
      <p className="mt-4 max-w-xl text-xs leading-relaxed text-[var(--muted)]">{t('privacy')}</p>
      {health && (
        <p className="mt-10 text-xs text-[var(--muted)]">{t('budgetToday', health.budget.spentToday.toFixed(2), health.budget.dailyLimit.toFixed(2))}</p>
      )}
    </main>
  );
}
