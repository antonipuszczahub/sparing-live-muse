import type { AuditResult, Moment, Wording } from '../../shared/audit.ts';
import type { Turn } from '../../shared/types.ts';

/** The words of the page, passed in so this stays pure (the caller translates them). */
export interface ReviewLabels {
  review: string;
  outcome: string;
  skills: string;
  skillNames: Record<keyof AuditResult['skills'], string>;
  moments: string;
  kinds: Record<Moment['kind'], string>;
  sayInstead: string;
  workNext: string;
  wording: string;
  wordingSaid: string;
  wordingBetter: string;
  wordingKinds: Record<Wording['kind'], string>;
}

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

/**
 * The review as Markdown text, to paste into notes or send to a coach: score, verdict, skills, the key moments with
 * the line to say instead, and what to work on. Nothing the character privately thought is included beyond what the
 * review itself already quotes.
 */
export function reviewAsText(input: { who: string; durationMs: number; result: AuditResult; turns: Turn[]; labels: ReviewLabels }): string {
  const { who, durationMs, result: r, turns, labels: L } = input;
  const lines: string[] = [];
  lines.push(`# ${L.review}: ${who} · ${clock(durationMs)}`, '', `**${r.score}/100** · ${L.outcome}`, '', `> ${r.verdict}`, '', r.summary, '');

  lines.push(`## ${L.skills}`);
  for (const k of Object.keys(r.skills) as (keyof AuditResult['skills'])[]) lines.push(`- ${L.skillNames[k]}: ${r.skills[k]}/10`);
  lines.push('');

  const byTurn = new Map(r.moments.map((m) => [m.turn, m]));
  const moments = [...byTurn.values()].sort((a, b) => a.turn - b.turn);
  if (moments.length) {
    lines.push(`## ${L.moments}`);
    for (const m of moments) {
      const at = turns[m.turn]?.at;
      lines.push(`### ${L.kinds[m.kind]}${at === undefined ? '' : ` · ${clock(at)}`}`, m.what, '', m.why);
      if (m.betterLine?.trim()) lines.push('', `${L.sayInstead}: “${m.betterLine.trim()}”`);
      lines.push('');
    }
  }

  if (r.wording?.length) {
    lines.push(`## ${L.wording}`);
    for (const w of r.wording) {
      const at = turns[w.turn]?.at;
      lines.push(`- ${at === undefined ? '' : `${clock(at)} · `}${L.wordingKinds[w.kind]} · ${L.wordingSaid}: “${w.said}” → ${L.wordingBetter}: “${w.better}”${w.note ? ` (${w.note})` : ''}`);
    }
    lines.push('');
  }

  if (r.nextFocus.length) {
    lines.push(`## ${L.workNext}`);
    r.nextFocus.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}
