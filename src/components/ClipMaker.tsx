import { useState } from 'react';
import type { AuditResult } from '../../shared/audit.ts';
import { scenarioDef } from '../../shared/scenarios.ts';
import type { Lang, Persona, ScenarioId, Turn } from '../../shared/types.ts';
import { t, translate, useLang } from '../i18n/index.ts';
import { clipSupported, renderClip, type ClipResult } from '../lib/clip.ts';

/** One-click captioned clip of the call's most telling moment, ready to post. */
export function ClipMaker({
  session,
  scenario,
  persona,
  turns,
  audit,
  lang = 'en',
  userGender = 'm',
}: {
  session: string;
  scenario: ScenarioId;
  persona: Persona;
  turns: Turn[];
  audit: AuditResult | null;
  lang?: Lang;
  /** Polish first-person text ("Przećwiczyłem" / "Przećwiczyłam") follows the user's gender. */
  userGender?: 'm' | 'f';
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
        siteLabel: location.host,
        lang,
        userGender,
        onProgress: setProgress,
      });
      setClip({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('clipFailed'));
    } finally {
      setProgress(null);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">{t('clipTitle')}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('clipBody')}</p>
        </div>
        <button
          onClick={make}
          disabled={progress !== null || turns.length < 2}
          className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:brightness-110 disabled:opacity-50"
        >
          {progress !== null ? t('recording', Math.round(progress * 100)) : clip ? t('makeAgain') : t('makeClip')}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {clip && (
        <div className="mt-4 grid gap-4 sm:grid-cols-[240px_1fr]">
          <video src={clip.url} controls loop playsInline className="w-full rounded-lg border border-[var(--line)]" />
          <div>
            <a
              href={clip.url}
              download={`sparing-live-clip.${clip.ext}`}
              className="inline-block rounded-lg border border-[var(--line)] px-4 py-2 text-sm hover:border-[#3a4160]"
            >
              {t('download', clip.ext, (clip.blob.size / 1024 / 1024).toFixed(1), Math.round(clip.seconds))}
            </a>
            {clip.ext === 'webm' && <p className="mt-2 text-xs text-amber-400">{t('webmNote')}</p>}
            <textarea
              value={post}
              onChange={(e) => setPost(e.target.value)}
              rows={5}
              className="mt-3 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={() => {
                void navigator.clipboard.writeText(post).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="mt-2 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm hover:border-[#3a4160]"
            >
              {copied ? t('copied') : t('copyPost')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
