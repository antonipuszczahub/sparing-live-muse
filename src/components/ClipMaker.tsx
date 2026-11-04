import { useState } from 'react';
import type { AuditResult } from '../../shared/audit.ts';
import { scenarioDef } from '../../shared/scenarios.ts';
import type { Lang, Mood, Persona, ScenarioId, Turn } from '../../shared/types.ts';
import { moodLabel, t, translate, useLang } from '../i18n/index.ts';
import { clipSupported, renderClip, type ClipResult } from '../lib/clip.ts';
import { vars } from '../lib/css.ts';
import { MOOD_COLOR_ON_DARK } from '../lib/mood.ts';
import { Archetype } from './Archetype.tsx';
import ui from './ui.module.css';
import styles from './ClipMaker.module.css';

/** The character's private thought closest to the moment the review picked out, for the preview. */
function previewThought(turns: Turn[], audit: AuditResult | null): string {
  const m = audit?.moments[0];
  const near = m ? [turns[m.turn + 1], turns[m.turn], turns[m.turn - 1]] : [];
  const bot = near.find((x) => x?.role === 'bot' && x.thought) ?? [...turns].reverse().find((x) => x.role === 'bot' && x.thought);
  return bot?.thought ?? '';
}

/** One-click captioned clip of the call's most telling moment, ready to post. */
/** What the clip tells people to visit: this site when it is hosted, the repository when the app runs on someone's own machine. */
const REPO_LINK = 'github.com/antonipuszczahub/sparing-live-muse';
const clipLink = () => (/^(localhost|127\.|\[::1\]|192\.168\.|10\.)/.test(location.host) ? REPO_LINK : location.host);

export function ClipMaker({
  session,
  scenario,
  persona,
  turns,
  audit,
  lang = 'en',
  userGender = 'm',
  open = false,
}: {
  session: string;
  scenario: ScenarioId;
  persona: Persona;
  turns: Turn[];
  audit: AuditResult | null;
  lang?: Lang;
  /** Polish first-person text ("Przećwiczyłem" / "Przećwiczyłam") follows the user's gender. */
  userGender?: 'm' | 'f';
  /** The character ran on open weights: the clip says so. */
  open?: boolean;
}) {
  useLang();
  const [progress, setProgress] = useState<number | null>(null);
  const [clip, setClip] = useState<(ClipResult & { url: string }) | null>(null);
  const [error, setError] = useState('');
  const [post, setPost] = useState(() => translate(lang, 'clipPost', scenarioDef(scenario, lang).title, location.origin, userGender));
  const [copied, setCopied] = useState(false);

  if (!clipSupported()) return null;

  async function make() {
    setError('');
    setClip(null);
    setProgress(0);
    try {
      const portraits = await fetch('/api/portraits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, scenario, persona, lang }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      const result = await renderClip({
        turns,
        persona,
        audit,
        portraits,
        siteLabel: clipLink(),
        lang,
        userGender,
        open,
        onProgress: setProgress,
      });
      setClip({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('clipFailed'));
    } finally {
      setProgress(null);
    }
  }

  const mood = ([...turns].reverse().find((x) => x.role === 'bot' && x.mood)?.mood ?? 3) as Mood;
  const first = persona.name.split(' ')[0]!;

  return (
    <section className={styles.clip}>
      <div>
        <h2 className={styles.title}>{t('clipTitle')}</h2>
        <p className={styles.body}>{t('clipBody')}</p>
        <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={make} disabled={progress !== null || turns.length < 2}>
          {progress !== null ? t('recording', Math.round(progress * 100)) : clip ? t('makeAgain') : t('makeClip')}
        </button>
        {error && <p className={styles.error}>{error}</p>}
        {clip && (
          <div className={styles.result}>
            <video src={clip.url} controls loop playsInline />
            <div>
              <a href={clip.url} download={`sparing-live-clip.${clip.ext}`} className={ui.btn}>
                {t('download', clip.ext, (clip.blob.size / 1024 / 1024).toFixed(1), Math.round(clip.seconds))}
              </a>
              {clip.ext === 'webm' && <p className={styles.note}>{t('webmNote')}</p>}
              <textarea value={post} onChange={(e) => setPost(e.target.value)} rows={5} className={styles.post} aria-label={t('copyPost')} />
              <div className={styles.actions}>
                <button
                  type="button"
                  className={ui.btn}
                  onClick={() => {
                    void navigator.clipboard.writeText(post).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    });
                  }}
                >
                  {copied ? t('copied') : t('copyPost')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className={styles.phone} style={vars({ '--c': MOOD_COLOR_ON_DARK[mood] })} aria-hidden="true">
        <div className={styles.face}>
          <Archetype scenario={scenario} />
        </div>
        <div className={styles.who}>
          <b>{first}</b>
          {moodLabel(mood, lang, persona.gender)}
        </div>
        <div className={styles.thought}>{previewThought(turns, audit)}</div>
        {audit && <div className={styles.score}>{audit.score}</div>}
        {/* the clip itself says both lines at the top; the small preview keeps one short label so it never runs into the quote */}
        <div className={styles.built}>{(open ? 'Muse Spark Open' : t('clipBuilt')).toUpperCase()}</div>
      </div>
    </section>
  );
}
