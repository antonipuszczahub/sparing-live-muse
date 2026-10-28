import type { Lang } from './types.ts';

export interface FaceBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
}

export interface FramingEvent {
  /** ms since the start of the call. */
  at: number;
  text: string;
}

const fmtSec = (ms: number) => `${Math.round(ms / 1000)} s`;

/** Polish uses noun forms on purpose: the camera does not know the user's gender. */
const TEXT = {
  en: {
    left: 'Left the frame',
    back: (sec: string) => `Back in frame after ${sec}`,
    off: 'Drifted out of position in the frame',
    away: 'Leaned back from the camera',
    near: 'Leaned in close to the camera',
  },
  pl: {
    left: 'Wyjście z kadru',
    back: (sec: string) => `Powrót do kadru po ${sec}`,
    off: 'Przesunięcie się poza środek kadru',
    away: 'Odsunięcie się od kamery',
    near: 'Przysunięcie się do kamery',
  },
} as const;

/**
 * Turns a stream of "where is the face in this frame" samples into a few plain facts about framing:
 * left the frame, drifted out of position, leaned back, leaned in. These describe what the camera saw
 * at a moment of the call. They say nothing about emotion or character, on purpose.
 */
export class FramingTracker {
  private warm: { area: number; cx: number }[] = [];
  private base: { area: number; cx: number } | null = null;
  private missing: { since: number; n: number; reported: boolean } | null = null;
  private streak = { off: 0, back: 0, near: 0 };
  private since = { off: 0, back: 0, near: 0 };
  private active = { off: false, back: false, near: false };
  private text;

  constructor(lang: Lang = 'en') {
    this.text = TEXT[lang];
  }

  /** Samples are expected every few seconds; a condition must hold for two samples in a row. */
  push(at: number, faces: FaceBox[]): FramingEvent[] {
    const out: FramingEvent[] = [];
    const face = [...faces].sort((a, b) => area(b) - area(a))[0];

    if (!face) {
      this.missing = this.missing ?? { since: at, n: 0, reported: false };
      this.missing.n += 1;
      if (this.missing.n >= 2 && !this.missing.reported) {
        this.missing.reported = true;
        out.push({ at: this.missing.since, text: this.text.left });
      }
      return out;
    }
    if (this.missing?.reported) out.push({ at, text: this.text.back(fmtSec(at - this.missing.since)) });
    this.missing = null;

    const a = area(face);
    const cx = (face.x1 + face.x2) / 2 / face.w;
    if (!this.base) {
      this.warm.push({ area: a, cx });
      if (this.warm.length === 3) {
        const med = (xs: number[]) => [...xs].sort((p, q) => p - q)[1]!;
        this.base = { area: med(this.warm.map((s) => s.area)), cx: med(this.warm.map((s) => s.cx)) };
      }
      return out;
    }

    const ratio = a / this.base.area;
    const conds = {
      off: { on: Math.abs(cx - this.base.cx) > 0.25, clear: Math.abs(cx - this.base.cx) < 0.15, text: this.text.off },
      back: { on: ratio < 0.55, clear: ratio > 0.75, text: this.text.away },
      near: { on: ratio > 1.7, clear: ratio < 1.3, text: this.text.near },
    } as const;
    for (const k of ['off', 'back', 'near'] as const) {
      const c = conds[k];
      if (c.on) {
        if (this.streak[k] === 0) this.since[k] = at;
        this.streak[k] += 1;
        if (this.streak[k] >= 2 && !this.active[k]) {
          this.active[k] = true;
          out.push({ at: this.since[k], text: c.text });
        }
      } else {
        this.streak[k] = 0;
        if (c.clear) this.active[k] = false;
      }
    }
    return out;
  }
}

function area(b: FaceBox) {
  return ((b.x2 - b.x1) * (b.y2 - b.y1)) / (b.w * b.h);
}
