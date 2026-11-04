import type { AuditResult } from '../../shared/audit.ts';
import type { Lang, Mood, Persona, Turn } from '../../shared/types.ts';
import { moodLabel, translate } from '../i18n/index.ts';
import { S_BOX, S_PATH, S_STROKE } from './logo.ts';
import { MOOD_COLOR_ON_DARK as MOOD_COLOR } from './mood.ts';

/**
 * Renders a short captioned clip of the most telling moment of a call: the counterpart's face
 * changes with its mood, lines are typed out, and its private thoughts appear under each reply.
 * It is drawn on a canvas and recorded in real time, so it needs no server and no video library.
 */
export interface ClipInput {
  turns: Turn[];
  persona: Persona;
  audit: AuditResult | null;
  portraits: { neutral: string; cold: string; warm: string } | null;
  siteLabel: string;
  /** Language of the call: captions, mood labels and the first-person intro. */
  lang?: Lang;
  /** The user's gender, for the Polish first-person intro ("Przećwiczyłem" / "Przećwiczyłam"). */
  userGender?: 'm' | 'f';
  /** The character ran on open weights (Muse Spark Open): the corner of the clip says so. */
  open?: boolean;
  onProgress?: (fraction: number) => void;
}

export interface ClipResult {
  blob: Blob;
  ext: 'mp4' | 'webm';
  seconds: number;
}

const W = 720;

// The clip is black with one orange accent, set in the app's own face.
const FONT = 'Figtree, Inter, system-ui, sans-serif';
const BG = '#0e0c0a';
const INK = '#f5f1ea';
const DIM = '#a79f94';
const CARD = '#211c18';
const ME = '#3a2415';
const ORANGE = '#ff5a1f';

const H = 900;

interface Step {
  turn: Turn;
  start: number;
  typeEnd: number;
  end: number;
}

/** Choose the turns to show: around the audit's turning point or biggest mistake, else the end of the call. */
export function pickWindow(turns: Turn[], audit: AuditResult | null): Turn[] {
  if (turns.length <= 5) return turns;
  const m = audit?.moments.find((x) => x.kind === 'turning-point') ?? audit?.moments.find((x) => x.kind === 'mistake');
  const center = m ? Math.min(Math.max(m.turn, 0), turns.length - 1) : turns.length - 2;
  let from = Math.max(0, center - 2);
  const to = Math.min(turns.length, from + 6);
  from = Math.max(0, to - 6);
  let slice = turns.slice(from, to);
  while (slice.length && slice[0]!.role === 'bot' && slice.length > 4) slice = slice.slice(1);
  return slice;
}

function schedule(turns: Turn[]): { steps: Step[]; intro: number; outro: number; total: number } {
  const intro = 1.6;
  const steps: Step[] = [];
  let t = intro;
  for (const turn of turns) {
    const typing = Math.min(3.2, Math.max(1, turn.text.length / 42));
    const thought = turn.role === 'bot' && turn.thought ? 1.8 : 0.5;
    steps.push({ turn, start: t, typeEnd: t + typing, end: t + typing + thought });
    t += typing + thought;
  }
  const outro = 3.2;
  return { steps, intro, outro, total: t + outro };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function loadImages(p: ClipInput['portraits']): Promise<Record<string, HTMLImageElement> | null> {
  if (!p) return null;
  const load = (src: string) =>
    new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  try {
    const [neutral, cold, warm] = await Promise.all([load(p.neutral), load(p.cold), load(p.warm)]);
    return { neutral, cold, warm };
  } catch {
    return null;
  }
}

export function clipSupported() {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

/** The logo: the S (drawn from the same path as the page) followed by "paring Live", baseline at `baseline`. */
function drawBrand(ctx: CanvasRenderingContext2D, x: number, baseline: number, size: number) {
  const h = size * 0.76;
  const k = h / S_BOX.h;
  ctx.save();
  ctx.translate(x, baseline - h + size * 0.038);
  ctx.scale(k, k);
  ctx.translate(-S_BOX.x, -S_BOX.y);
  ctx.lineWidth = S_STROKE;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ORANGE;
  ctx.stroke(new Path2D(S_PATH));
  ctx.restore();
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = 'left';
  const tx = x + S_BOX.w * k - size * 0.13;
  ctx.fillStyle = INK;
  ctx.fillText('paring', tx, baseline);
  ctx.fillStyle = ORANGE;
  ctx.fillText('Live', tx + ctx.measureText('paring ').width, baseline);
}

export async function renderClip(input: ClipInput): Promise<ClipResult> {
  // The canvas only knows fonts that are already loaded.
  await document.fonts.load(`700 26px ${FONT}`).catch(() => undefined);
  const turns = pickWindow(input.turns, input.audit);
  const plan = schedule(turns);
  const imgs = await loadImages(input.portraits);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const stream = canvas.captureStream(30);
  const mime = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error('This browser cannot record video.');
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_500_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));

  const lang = input.lang ?? 'en';
  const say = (key: Parameters<typeof translate>[1], ...args: unknown[]) => (translate as (l: Lang, k: unknown, ...a: unknown[]) => string)(lang, key, ...args);
  const first = input.persona.name.split(' ')[0]!;
  const initials = input.persona.name.split(' ').map((w) => w[0]).join('');
  let mood: Mood = (turns.find((t) => t.role === 'bot' && t.mood)?.mood ?? 3) as Mood;
  // The face cross-fades between expressions; track an eased blend per expression.
  const alpha = { cold: 0, neutral: 1, warm: 0 };
  const face = (m: Mood) => (m <= 2 ? 'cold' : m >= 4 ? 'warm' : 'neutral') as 'cold' | 'neutral' | 'warm';

  function frame(t: number) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const step = plan.steps.find((s) => t >= s.start && t < s.end) ?? (t >= plan.total - plan.outro ? null : plan.steps.filter((s) => s.end <= t).at(-1) ?? null);
    if (step?.turn.role === 'bot' && step.turn.mood && t >= step.start) mood = step.turn.mood;

    for (const k of ['cold', 'neutral', 'warm'] as const) alpha[k] += ((face(mood) === k ? 1 : 0) - alpha[k]) * 0.12;

    // brand
    ctx.fillStyle = INK;
    ctx.font = `600 26px ${FONT}`;
    ctx.textAlign = 'left';
    drawBrand(ctx, 36, 52, 26);
    ctx.fillStyle = DIM;
    ctx.font = `18px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(say('clipBuilt'), W - 36, 50);
    if (input.open) {
      ctx.fillStyle = ORANGE;
      ctx.font = `600 15px ${FONT}`;
      ctx.fillText(say('clipOpen'), W - 36, 74);
    }

    // face
    const fx = 190;
    const fy = 86;
    const fs = 340;
    ctx.save();
    roundRect(ctx, fx, fy, fs, fs, 28);
    ctx.clip();
    ctx.fillStyle = CARD;
    ctx.fillRect(fx, fy, fs, fs);
    if (imgs) {
      for (const k of ['neutral', 'cold', 'warm'] as const) {
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha[k]));
        ctx.drawImage(imgs[k]!, fx, fy, fs, fs);
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = DIM;
      ctx.font = `600 96px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(initials, fx + fs / 2, fy + fs / 2 + 32);
    }
    ctx.restore();
    ctx.lineWidth = 5;
    ctx.strokeStyle = MOOD_COLOR[mood]!;
    roundRect(ctx, fx, fy, fs, fs, 28);
    ctx.stroke();

    // name + mood
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = `600 28px ${FONT}`;
    ctx.fillText(input.persona.name, W / 2, fy + fs + 46);
    ctx.fillStyle = MOOD_COLOR[mood]!;
    ctx.font = `22px ${FONT}`;
    ctx.fillText(moodLabel(mood, lang, input.persona.gender), W / 2, fy + fs + 80);
    for (let i = 1; i <= 5; i++) {
      ctx.fillStyle = i <= mood ? MOOD_COLOR[mood]! : '#3a332c';
      roundRect(ctx, W / 2 - 130 + (i - 1) * 54, fy + fs + 96, 48, 8, 4);
      ctx.fill();
    }

    const bodyTop = fy + fs + 140;

    if (t < plan.intro) {
      ctx.textAlign = 'center';
      ctx.fillStyle = INK;
      ctx.font = `600 38px ${FONT}`;
      ctx.fillText(say('clipIntro1', input.userGender ?? 'm'), W / 2, bodyTop + 60);
      ctx.fillText(say('clipIntro2'), W / 2, bodyTop + 108);
      return;
    }

    if (t >= plan.total - plan.outro) {
      const a = input.audit;
      ctx.textAlign = 'center';
      ctx.fillStyle = INK;
      ctx.font = `600 70px ${FONT}`;
      ctx.fillText(a ? `${a.score}/100` : say('clipOver'), W / 2, bodyTop + 66);
      if (a) {
        ctx.fillStyle = '#d8d0c5';
        ctx.font = `26px ${FONT}`;
        wrap(ctx, a.verdict, W - 120)
          .slice(0, 3)
          .forEach((l, i) => ctx.fillText(l, W / 2, bodyTop + 116 + i * 36));
      }
      ctx.fillStyle = ORANGE;
      const invite = say('clipPractice', input.siteLabel);
      // a long address (the repository) shrinks to fit instead of running off the edge
      let size = 24;
      ctx.font = `600 ${size}px ${FONT}`;
      while (ctx.measureText(invite).width > W - 60 && size > 13) ctx.font = `600 ${--size}px ${FONT}`;
      ctx.fillText(invite, W / 2, H - 50);
      return;
    }

    if (!step) return;
    const turn = step.turn;
    const bot = turn.role === 'bot';
    const shown = Math.min(turn.text.length, Math.floor((t - step.start) * 46));
    const text = turn.text.slice(0, shown);

    ctx.font = `30px ${FONT}`;
    const lines = wrap(ctx, text || ' ', W - 150).slice(-5);
    const boxH = lines.length * 40 + 36;
    const boxW = W - 90;
    const bx = bot ? 36 : W - 36 - boxW;
    ctx.fillStyle = bot ? CARD : ME;
    roundRect(ctx, bx, bodyTop, boxW, boxH, 22);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    lines.forEach((l, i) => ctx.fillText(l, bx + 24, bodyTop + 50 + i * 40));
    ctx.fillStyle = DIM;
    ctx.font = `16px ${FONT}`;
    ctx.fillText(bot ? first : say('you'), bx + 24, bodyTop + 22);

    if (bot && turn.thought && t >= step.typeEnd) {
      const k = Math.min(1, (t - step.typeEnd) / 0.35);
      ctx.globalAlpha = k;
      ctx.font = `italic 27px ${FONT}`;
      const tl = wrap(ctx, `${say('thinks')} ${turn.thought}`, W - 120).slice(0, 3);
      ctx.fillStyle = MOOD_COLOR[turn.mood ?? 3]!;
      tl.forEach((l, i) => ctx.fillText(l, 52, bodyTop + boxH + 52 + i * 36));
      ctx.globalAlpha = 1;
    }
  }

  const start = performance.now();
  rec.start(250);
  await new Promise<void>((resolve) => {
    const loop = () => {
      const t = (performance.now() - start) / 1000;
      frame(Math.min(t, plan.total - 0.01));
      input.onProgress?.(Math.min(1, t / plan.total));
      if (t >= plan.total) resolve();
      // A timer, not requestAnimationFrame: rAF stops entirely in a background tab and would freeze the recording.
      else window.setTimeout(loop, 33);
    };
    loop();
  });
  rec.stop();
  await done;
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm', seconds: plan.total };
}
