import type { TwinProfile } from '../../shared/types.ts';
import { Brand } from '../components/Brand.tsx';
import { Icon, type IconName } from '../components/Icons.tsx';
import ui from '../components/ui.module.css';
import { t } from '../i18n/index.ts';
import s from './Twin.module.css';

export interface Step {
  kind: 'search' | 'open' | 'note';
  text: string;
}

const STEP_ICON = { search: 'search', open: 'page', note: 'leaf' } as const satisfies Record<Step['kind'], IconName>;
const stepLabel = (kind: Step['kind']) => (kind === 'search' ? t('stepSearching') : kind === 'open' ? t('stepReading') : '');

/** The research on a real company, shown as a vine that grows one point per step, and the profile it ends with. */
export function TwinView({
  company,
  steps,
  twin,
  error,
  secs,
  onReady,
  onSkip,
}: {
  company: string;
  steps: Step[];
  twin: TwinProfile | null;
  error: string;
  secs: number;
  onReady: (twin: TwinProfile) => void;
  onSkip: () => void;
}) {
  return (
    <main className={s.page}>
      <header className={ui.rise1}>
        <Brand size={32} />
      </header>

      <div className={s.main}>
        <div className={ui.rise2}>
          <h1 className={s.title}>{t('twinTitle')}</h1>
          <p className={s.intro}>
            {t('twinIntroA')}
            <strong>{company}</strong>
            {t('twinIntroB')}
          </p>
        </div>

        <ol className={`${s.steps} ${ui.rise3}`}>
          {steps.map((st, i) => (
            <li key={i} className={s.step}>
              <span className={`${s.node} ${st.kind === 'note' ? s.noteNode : ''}`} />
              <span className={s.text}>
                {stepLabel(st.kind) && (
                  <span className={s.kind}>
                    <Icon name={STEP_ICON[st.kind]} size={14} />
                    {stepLabel(st.kind)}
                  </span>
                )}
                <span className={st.kind === 'note' ? s.thought : ''}>{st.text}</span>
              </span>
            </li>
          ))}
          {!twin && !error && (
            <li className={`${s.step} ${s.waiting}`}>
              <span className={s.node} />
              <span className={`${s.text} ${s.wait}`}>{t('working', secs)}</span>
            </li>
          )}
        </ol>

        {error && (
          <div className={s.card}>
            <p className={`${ui.note} ${ui.noteBad}`}>{error}</p>
            <button type="button" className={`${ui.btn} ${s.go}`} onClick={onSkip}>
              {t('continueGeneric')}
            </button>
          </div>
        )}

        {twin && (
          <section className={`${s.card} ${ui.glass}`}>
            <span className={s.ready}>{t('twinReady')}</span>
            <h2 className={s.company}>{twin.company}</h2>
            <p className={s.summary}>{twin.summary}</p>
            <p className={`${s.summary} ${s.who}`}>
              <span>{t('youWillTalk')}</span>
              <b>{twin.buyerRole}</b>
              <br />
              {twin.buyerBio}
            </p>
            <div className={s.lists}>
              <div>
                <h3>{t('whatHurts')}</h3>
                <ul>
                  {twin.pains.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>{t('expectHear')}</h3>
                <ul>
                  {twin.objections.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
            {twin.sources.length > 0 && (
              <div className={s.sources}>
                {t('sourcesRead')}{' '}
                {twin.sources.map((u, i) => (
                  <span key={u}>
                    {i > 0 && ' · '}
                    {new URL(u).hostname.replace(/^www\./, '')}
                  </span>
                ))}
              </div>
            )}
            <button type="button" className={`${ui.btn} ${ui.btnPrimary} ${s.go}`} onClick={() => onReady(twin)}>
              {t('callThem')}
              <Icon name="phone" size={18} stroke={2} />
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
