import { useState } from 'react';
import type { AuditResult } from '../../shared/audit.ts';
import { SCENARIOS } from '../../shared/scenarios.ts';
import type { Persona, ScenarioId, Turn } from '../../shared/types.ts';
import { clipSupported, renderClip, type ClipResult } from '../lib/clip.ts';

/** One-click captioned clip of the call's most telling moment, ready to post. */
export function ClipMaker({
  session,
  scenario,
  persona,
  turns,
  audit,
}: {
  session: string;
  scenario: ScenarioId;
  persona: Persona;
  turns: Turn[];
  audit: AuditResult | null;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [clip, setClip] = useState<(ClipResult & { url: string }) | null>(null);
  const [error, setError] = useState('');
  const [post, setPost] = useState(
    `I rehearsed a ${SCENARIOS[scenario].title.toLowerCase()} with an AI that hides its thoughts, then watched the replay of what it was really thinking.\n\nBuilt on @AIatMeta Muse models for @cerebral_valley. Try it: ${location.origin}`,
  );
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
        body: JSON.stringify({ session, scenario, persona }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      const result = await renderClip({
        turns,
        persona,
        audit,
        portraits,
        siteLabel: location.host,
        onProgress: setProgress,
      });
      setClip({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not make the clip.');
    } finally {
      setProgress(null);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Share the moment</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            A short captioned clip of the key moment: their face, their private thoughts, your score. It is drawn in your browser and takes about as long as it plays. Keep this tab in front while it records.
          </p>
        </div>
        <button
          onClick={make}
          disabled={progress !== null || turns.length < 2}
          className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:brightness-110 disabled:opacity-50"
        >
          {progress !== null ? `Recording… ${Math.round(progress * 100)}%` : clip ? 'Make it again' : 'Make a clip'}
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
              Download .{clip.ext} ({(clip.blob.size / 1024 / 1024).toFixed(1)} MB, {Math.round(clip.seconds)} s)
            </a>
            {clip.ext === 'webm' && <p className="mt-2 text-xs text-amber-400">This browser records WebM. X wants MP4, so convert it or record again in Edge or Chrome.</p>}
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
              {copied ? 'Copied' : 'Copy post text'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
