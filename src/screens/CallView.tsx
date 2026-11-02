import type { RefObject } from 'react';
import type { FaceBox } from '../../shared/framing.ts';
import { langOf } from '../../shared/lang.ts';
import { scenarioDef } from '../../shared/scenarios.ts';
import type { SessionConfig } from '../../shared/types.ts';
import type { CallSnapshot } from '../engine/CallEngine.ts';
import { Brand } from '../components/Brand.tsx';
import { Icon } from '../components/Icons.tsx';
import { LeafMeter } from '../components/LeafMeter.tsx';
import { Portrait } from '../components/Portrait.tsx';
import ui from '../components/ui.module.css';
import { moodLabel, t } from '../i18n/index.ts';
import { buildCaptions, captionSize } from '../lib/captions.ts';
import s from './Call.module.css';

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export interface CallViewProps {
  session: string;
  config: SessionConfig;
  snap: CallSnapshot;
  voiceName?: string;
  camOn: boolean;
  face: FaceBox | null;
  selfView: RefObject<HTMLVideoElement | null>;
  sharing: boolean;
  seen: string;
  typed: string;
  canCamera: boolean;
  canShare: boolean;
  onTyped: (text: string) => void;
  onSend: () => void;
  onCamera: () => void;
  onShare: () => void;
  onHangUp: () => void;
}

/** The call: their face, their mood, the words, and the controls. Everything it shows comes in as props. */
export function CallView(p: CallViewProps) {
  const { config, snap } = p;
  const lang = langOf(config);
  const persona = config.persona;
  const sc = scenarioDef(config.scenario, lang);
  const first = persona.name.split(' ')[0]!;
  const ended = snap.state === 'ended';
  const label = moodLabel(snap.mood, lang, persona.gender);
  const statusText = {
    connecting: t('connecting'),
    listening: t('listening'),
    thinking: t('thinking', first),
    speaking: t('speaking', first),
    ended: snap.endReason === 'hangup' ? t('hungUpBy', first, persona.gender) : t('callEnded'),
  }[snap.state];

  return (
    <main className={s.page}>
      <header className={`${s.top} ${ui.rise1}`}>
        <div className={s.topBrand}>
          <Brand size={32} />
        </div>
        <span className={`${s.live} ${ended ? s.liveEnded : ''}`}>
          <b />
          {ended ? t('callEnded') : t('live')}
          <span>{fmt(snap.elapsedMs)}</span>
        </span>
        <div className={s.topRight}>
          {config.provider === 'open' && (
            <span className={ui.pill}>
              <b />
              {t('openBadge')}
            </span>
          )}
        </div>
      </header>

      <section className={`${s.stage} ${ui.rise2}`}>
        <div className={s.who}>
          <div className={s.parch}>
            <span className={`${s.wave} ${snap.state === 'speaking' ? s.speaking : ''}`} />
            <span className={`${s.wave} ${s.w2} ${snap.state === 'speaking' ? s.speaking : ''}`} />
            <span className={s.face}>
              <Portrait session={p.session} scenario={config.scenario} persona={persona} lang={lang} mood={snap.mood} />
            </span>
          </div>
          <div className={s.meta}>
            <h1 className={s.nm}>{persona.name}</h1>
            <span className={s.role}>
              {persona.role} · {sc.title}
            </span>
            {p.voiceName && <span className={s.voice}>{t('voiceInUse', p.voiceName)}</span>}
            <div className={s.mood}>
              <LeafMeter mood={snap.mood} label={label} />
              <span className={s.ml}>{label}</span>
            </div>
          </div>
          {p.camOn && (
            <div className={s.self}>
              <video ref={p.selfView} autoPlay muted playsInline />
              {p.face && (
                <span
                  className={s.faceBox}
                  style={{
                    left: `${(1 - p.face.x2 / p.face.w) * 100}%`,
                    top: `${(p.face.y1 / p.face.h) * 100}%`,
                    width: `${((p.face.x2 - p.face.x1) / p.face.w) * 100}%`,
                    height: `${((p.face.y2 - p.face.y1) / p.face.h) * 100}%`,
                  }}
                />
              )}
              <span className={s.samBadge}>{t('samBadge')}</span>
            </div>
          )}
        </div>

        <div className={`${s.cap} ${ui.rise3}`} aria-live="polite">
          {buildCaptions(snap.turns, snap.liveBot, snap.liveUser).map((c) => {
            const bot = c.role === 'bot';
            const size = c.now ? captionSize(c.text) : 'normal';
            const kind = c.now ? `${s.now} ${size === 'normal' ? '' : s[size]}` : c.recent ? s.recent : s.hist;
            return (
              <div key={c.key} className={`${s.ln} ${bot ? '' : s.me} ${kind}`}>
                <span className={s.tag}>{bot ? first : t('you')}</span>
                <p className={bot ? s.tDana : s.tMe}>
                  {c.text}
                  {c.live && <span className={s.caret} />}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className={`${s.dockrow} ${ui.rise4}`}>
        {p.sharing && (
          <details className={s.seen}>
            <summary>
              <Icon name="eye" size={16} />
              {p.seen ? t('canSee', first) : t('sharingLooking')}
            </summary>
            {p.seen && <p>{p.seen}</p>}
          </details>
        )}
        {snap.error && <p className={`${ui.note} ${ui.noteBad}`}>{snap.error}</p>}
        <div className={`${s.dock} ${ui.glass}`}>
          <div className={s.stat}>
            <span className={`${s.eq} ${snap.state === 'listening' ? s.eqOn : ''}`} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>
              <b>{statusText}</b>
              {snap.lastLatencyMs != null && <small>{t('firstWord', (snap.lastLatencyMs / 1000).toFixed(1))}</small>}
            </span>
          </div>
          <form
            className={s.typeForm}
            onSubmit={(e) => {
              e.preventDefault();
              p.onSend();
            }}
          >
            <input className={s.typ} value={p.typed} onChange={(e) => p.onTyped(e.target.value)} placeholder={t('typePlaceholder')} aria-label={t('typePlaceholder')} />
          </form>
          {p.canCamera && (
            <button
              type="button"
              className={`${s.ib} ${s.cam} ${p.camOn ? s.on : ''}`}
              onClick={p.onCamera}
              disabled={ended}
              aria-pressed={p.camOn}
              aria-label={p.camOn ? t('cameraOff') : t('cameraOn')}
              title={p.camOn ? t('cameraOff') : t('cameraOn')}
            >
              <Icon name="video" />
            </button>
          )}
          {p.canShare && (
            <button
              type="button"
              className={`${s.ib} ${s.share} ${p.sharing ? s.on : ''}`}
              onClick={p.onShare}
              disabled={ended}
              aria-pressed={p.sharing}
              aria-label={p.sharing ? t('stopSharing') : t('shareScreen')}
              title={p.sharing ? t('stopSharing') : t('shareScreen')}
            >
              <Icon name="monitor" />
            </button>
          )}
          <button type="button" className={s.hang} onClick={p.onHangUp} disabled={ended} aria-label={t('hangUp')} title={t('hangUp')}>
            <Icon name="phone" size={26} stroke={2} />
          </button>
        </div>
      </section>
    </main>
  );
}
