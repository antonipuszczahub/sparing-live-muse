import { useEffect, useRef, useState } from 'react';
import { LANG_META, LANGS } from '../../shared/lang.ts';
import { levelDef, scenarioDef, SCENARIO_IDS } from '../../shared/scenarios.ts';
import type { Level, ScenarioId, SessionConfig } from '../../shared/types.ts';
import { Archetype } from '../components/Archetype.tsx';
import { Brand } from '../components/Brand.tsx';
import { Icon } from '../components/Icons.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { Switch } from '../components/Switch.tsx';
import { AboutSheet } from '../components/AboutSheet.tsx';
import { AudioCheck } from '../components/AudioCheck.tsx';
import { MicPicker } from '../components/MicPicker.tsx';
import { Progress } from '../components/Progress.tsx';
import { useVoiceList, VoicePicker } from '../components/VoicePicker.tsx';
import ui from '../components/ui.module.css';
import { setLang, t, useLang } from '../i18n/index.ts';
import { vars } from '../lib/css.ts';
import { clearWeakSpots, topWeakSpots } from '../lib/memory.ts';
import { loadUser, saveUser, type UserProfile } from '../lib/profile.ts';
import { sttSupported } from '../lib/stt.ts';
import s from './Setup.module.css';

interface Health {
  ok: boolean;
  keyConfigured: boolean;
  openWeights?: boolean;
  /** The server runs the character on open weights unless the visitor unticks the box. */
  openDefault?: boolean;
  openHost?: string;
  openModel?: string;
  budget: { spentToday: number; dailyLimit: number };
}

const WHO = { sales: 'whoSales', defense: 'whoDefense', salary: 'whoSalary', pitch: 'whoPitch' } as const satisfies Record<ScenarioId, string>;

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
  const [voices, setVoices] = useState(false);
  const [about, setAbout] = useState(false);
  const rails = useRef<HTMLElement>(null);
  const { list: voiceList, total: voiceTotal } = useVoiceList(lang);
  const missingVoice = voiceTotal > 0 && voiceList.length === 0;
  const sc = scenarioDef(scenario, lang);
  const lv = levelDef(level, lang);
  const showCompany = scenario !== 'defense';

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((h: Health) => {
        setHealth(h);
        if (h.openDefault) setOpenWeights(true);
      })
      .catch(() => setHealth(null));
  }, []);

  // Weak spots are kept per language, so switching language shows that language's list.
  useEffect(() => setWeak(topWeakSpots(3, lang)), [lang]);

  // On a phone the four counterparts are a swipeable row: bring the chosen one to the middle.
  useEffect(() => {
    const rail = rails.current;
    const card = rail?.querySelector<HTMLElement>('[data-on="true"]');
    if (!rail || !card || rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollTo({ left: card.offsetLeft - (rail.clientWidth - card.clientWidth) / 2, behavior: 'smooth' });
  }, [scenario]);

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
        .then((st) => st.getTracks().forEach((tr) => tr.stop()))
        .catch(() => undefined);
      const r = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario,
          level,
          topic: topic.trim() || sc.topicExample,
          focus: useMemory && weak.length ? weak : undefined,
          provider: health?.openWeights ? (openWeights ? 'open' : 'meta') : undefined,
          lang,
          user: lang === 'pl' ? user : undefined,
        }),
      });
      if (!r.ok) throw new Error(t('sessionFailed'));
      const { session, config } = (await r.json()) as { session: string; config: SessionConfig };
      if (company.trim() && showCompany) onTwin(session, config, company.trim());
      else onStart(session, config);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('somethingWrong'));
      setBusy(false);
    }
  }

  // The button is drawn twice: inside the bar on wide screens, pinned to the bottom on phones.
  const cta = (
    <button type="button" className={s.cta} onClick={start} disabled={busy}>
      {busy ? t('connecting') : t('startCall')}
      <span className={s.ic}>
        <Icon name="phone" size={20} stroke={2} />
      </span>
    </button>
  );
  const notices = [!sttSupported() && t('needsEdge'), missingVoice && t('noVoice'), health && !health.keyConfigured && t('keyMissing')].filter(Boolean) as string[];

  return (
    <main className={s.page} style={vars({ '--a': SCENARIO_IDS.indexOf(scenario) + 1 })}>
      <header className={`${s.top} ${ui.rise1}`}>
        <Brand />
        <div className={s.tools}>
          {health?.openWeights && (
            <button
              type="button"
              className={`${ui.pill} ${openWeights ? '' : ui.pillOff}`}
              aria-pressed={openWeights}
              title={t('openBody', health.openModel ?? '', health.openHost ?? '')}
              onClick={() => setOpenWeights(!openWeights)}
            >
              <b />
              {t('openBadge')}
              {openWeights && health.openHost ? ` · ${health.openHost}` : ''}
            </button>
          )}
          <button
            type="button"
            className={ui.pill}
            title={t('demoPresetBody')}
            onClick={() => setAbout(true)}
          >
            <Icon name="phone" size={16} />
            {t('demoPreset')}
          </button>
          <button type="button" className={ui.pill} onClick={() => setVoices(true)}>
            <Icon name="voice" size={16} />
            {t('voiceTitle')}
          </button>
          <div role="group" aria-label={t('languageLabel')} className={ui.seg}>
            {LANGS.map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}>
                {LANG_META[l].name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className={s.stage}>
        <div className={s.intro}>
          <section className={`${s.hero} ${ui.rise2}`}>
            <h1 className={s.h1}>
              {t('heroTop')} <em>{t('heroEm')}</em>
            </h1>
            <p className={s.lead}>{t('heroLead')}</p>
          </section>

          {(notices.length > 0 || error) && (
            <div className={s.notices} role="status">
              {notices.map((n) => (
                <p key={n} className={ui.note}>
                  {n}
                </p>
              ))}
              {error && <p className={`${ui.note} ${ui.noteBad}`}>{error}</p>}
            </div>
          )}

          <section className={`${s.bar} ${ui.glass} ${ui.rise3}`}>
            <label className={s.fld}>
              <span className={`${ui.lbl} ${s.lbl}`}>
                <span key={scenario} className={s.swap}>
                  {sc.topicLabel}
                </span>
              </span>
              <input className={s.in} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={sc.topicExample} />
            </label>
            {showCompany && (
              <label className={s.fld}>
                <span className={`${ui.lbl} ${s.lbl}`}>
                  {t('twinLabel')} · {t('optional')}
                </span>
                <input className={s.in} value={company} onChange={(e) => setCompany(e.target.value)} placeholder={sc.twinExample} title={t('twinOptional')} />
              </label>
            )}
            <div className={s.fld} role="radiogroup" aria-label={t('difficulty')}>
              <span className={`${ui.lbl} ${s.lbl}`}>{t('difficulty')}</span>
              <div className={s.levels}>
                {([1, 2, 3, 4] as Level[]).map((l) => (
                  <label key={l} className={s.lvl}>
                    <input className={ui.sr} type="radio" name="level" checked={level === l} onChange={() => setLevel(l)} />
                    <span>{levelDef(l, lang).name}</span>
                  </label>
                ))}
              </div>
              <p className={s.blurb}>
                <span key={level}>{lv.blurb}</span>
              </p>
            </div>
            <div className={s.ctaInline}>{cta}</div>
          </section>

          {lang === 'pl' && (
            <section className={s.you} aria-label={t('userTitle')}>
              <div className={s.youGroup}>
                <span>{t('userGender')}</span>
                <div role="group" className={ui.seg}>
                  <button type="button" aria-pressed={user.gender === 'm'} onClick={() => changeUser({ ...user, gender: 'm' })}>
                    {t('userMan')}
                  </button>
                  <button type="button" aria-pressed={user.gender === 'f'} onClick={() => changeUser({ ...user, gender: 'f' })}>
                    {t('userWoman')}
                  </button>
                </div>
              </div>
              <div className={s.youGroup}>
                <span>{t('userForm')}</span>
                <div role="group" className={ui.seg}>
                  <button type="button" aria-pressed={user.formal} onClick={() => changeUser({ ...user, formal: true })}>
                    {t('userFormal')}
                  </button>
                  <button type="button" aria-pressed={!user.formal} onClick={() => changeUser({ ...user, formal: false })}>
                    {t('userInformal')}
                  </button>
                </div>
              </div>
              <p className={s.youWhy}>{t('userWhy')}</p>
            </section>
          )}

          <footer className={s.foot}>
            <Progress lang={lang} />
            {weak.length > 0 && (
              <section className={s.memory}>
                <div className={s.memoryHead}>
                  <span className={ui.lbl}>{t('practising')}</span>
                  <button
                    type="button"
                    className={s.forget}
                    onClick={() => {
                      clearWeakSpots(lang);
                      setWeak([]);
                    }}
                  >
                    {t('weakForget')}
                  </button>
                </div>
                <div className={s.chips}>
                  {weak.map((w) => (
                    <span key={w} className={s.chip}>
                      {w}
                    </span>
                  ))}
                </div>
                <Switch checked={useMemory} onChange={setUseMemory}>
                  {t('weakUse')}
                </Switch>
              </section>
            )}
            <span className={s.hint}>
              <Icon name="headphones" size={16} />
              {t('headphones')}
              {health && ` · ${t('budgetToday', health.budget.spentToday.toFixed(2), health.budget.dailyLimit.toFixed(2))}`}
            </span>
          </footer>
        </div>

        <section ref={rails} role="radiogroup" aria-label={t('tagline')} className={`${s.cast} ${ui.rise3}`}>
          {SCENARIO_IDS.map((id, i) => {
            const def = scenarioDef(id, lang);
            return (
              <label key={id} className={s.card} data-on={scenario === id}>
                <input className={ui.sr} type="radio" name="scenario" checked={scenario === id} onChange={() => setScenario(id)} />
                <span className={s.shot}>
                  <Archetype scenario={id} />
                  <span className={s.veil} />
                  <span className={s.tag}>0{i + 1}</span>
                  <span className={s.cap}>
                    <span className={s.ct}>{def.title}</span>
                    <span className={s.cp}>{t(WHO[id])}</span>
                    <span className={s.tg}>{def.tagline}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </section>
      </div>

      <details className={s.privacy}>
        <summary>
          {t('privacyShort')} <span>{t('privacyMore')}</span>
        </summary>
        <p>{t('privacy')}</p>
      </details>

      <div className={s.ctaSticky}>{cta}</div>

      <AboutSheet
        open={about}
        onClose={() => setAbout(false)}
        onStartDemo={() => {
          // the recording: the investor, a realistic level and a pitch with real numbers in it
          setScenario('pitch');
          setLevel(2);
          setTopic(t('demoTopic'));
          setAbout(false);
        }}
      />

      <Sheet open={voices} title={t('voiceTitle')} onClose={() => setVoices(false)}>
        <VoicePicker lang={lang} list={voiceList} />
        <MicPicker />
        <AudioCheck lang={lang} />
      </Sheet>
    </main>
  );
}
