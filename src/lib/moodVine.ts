import type { Moment } from '../../shared/audit.ts';
import type { Mood } from '../../shared/types.ts';

/** One point of the chart: the character's mood after one of their turns. */
export interface MoodNode {
  /** Index into the transcript. */
  turn: number;
  mood: Mood;
  /** ms since the start of the call. */
  at: number;
}

export interface LaidNode extends MoodNode {
  x: number;
  y: number;
  /** Where the leaf grows from, and how it is turned. */
  leafX: number;
  leafY: number;
  rot: number;
  showTime: boolean;
}

export interface LaidFlag {
  turn: number;
  kind: Moment['kind'];
  letter: string;
  /** Centre of the badge. */
  x: number;
  y: number;
  /** The dashed line runs between the badge and the vine: from, to along the cross axis. */
  from: number;
  to: number;
}

export interface MoodVineLayout {
  vertical: boolean;
  width: number;
  height: number;
  path: string;
  /** One guide line per mood, as the position along the mood axis. */
  guides: { mood: Mood; pos: number }[];
  nodes: LaidNode[];
  flags: LaidFlag[];
}

/** A, B, C … for the moments of a review, in transcript order, so the chart and the replay agree. */
export function momentLetters(moments: { turn: number }[]): Map<number, string> {
  const letters = new Map<number, string>();
  [...moments]
    .sort((a, b) => a.turn - b.turn)
    .slice(0, 8)
    .forEach((m, i) => letters.set(m.turn, String.fromCharCode(65 + i)));
  return letters;
}

const MOODS: Mood[] = [1, 2, 3, 4, 5];

/**
 * Lays the character's mood over the call out as a vine. Wide screens grow it from left to right, phones from top to bottom;
 * a flag sits between the two turns that surround the moment it marks.
 */
export function layoutMoodVine(nodes: MoodNode[], moments: { turn: number; kind: Moment['kind'] }[], vertical: boolean): MoodVineLayout | null {
  const n = nodes.length;
  if (n < 2) return null;
  const letters = momentLetters(moments);
  const showEvery = Math.ceil(n / 8);

  // the mood axis (crosses the lines) and the time axis (runs along the vine)
  const start = vertical ? 52 : 108;
  const end = vertical ? 52 + (n - 1) * 56 : 598;
  const step = vertical ? 56 : Math.min(140, (end - start) / (n - 1));
  const width = vertical ? 350 : 640;
  const height = vertical ? end + 40 : 400;
  const moodAt = (m: Mood) => (vertical ? 70 + (m - 1) * 52 : 330 - (m - 1) * 68);

  const laid: LaidNode[] = nodes.map((node, i) => {
    const along = start + i * step;
    const across = moodAt(node.mood);
    const even = i % 2 === 0;
    return vertical
      ? { ...node, x: across, y: along, leafX: across + (even ? 6 : -6), leafY: along - 2, rot: even ? 52 : -52, showTime: i % showEvery === 0 }
      : { ...node, x: along, y: across, leafX: along, leafY: across - 6, rot: even ? -34 : 36, showTime: i % showEvery === 0 };
  });

  let path = `M${laid[0]!.x},${laid[0]!.y}`;
  for (let i = 1; i < n; i++) {
    const a = laid[i - 1]!;
    const b = laid[i]!;
    if (vertical) {
      const my = (a.y + b.y) / 2;
      path += ` C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
    } else {
      const mx = (a.x + b.x) / 2;
      path += ` C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
    }
  }
  const last = laid[n - 1]!;
  // a curl at the tip, like the vines in the background
  path += vertical
    ? ` C${last.x},${last.y + 12} ${last.x + 10},${last.y + 22} ${last.x + 20},${last.y + 16} C${last.x + 28},${last.y + 10} ${last.x + 22},${last.y + 2} ${last.x + 16},${last.y + 6}`
    : ` C${last.x + 16},${last.y} ${last.x + 28},${last.y - 8} ${last.x + 24},${last.y - 22} C${last.x + 20},${last.y - 34} ${last.x + 6},${last.y - 32} ${last.x + 8},${last.y - 20}`;

  const flags: LaidFlag[] = [];
  for (const m of [...moments].sort((a, b) => a.turn - b.turn)) {
    const letter = letters.get(m.turn);
    if (!letter) continue;
    const before = laid.filter((node) => node.turn < m.turn).length;
    const a = laid[before - 1];
    const b = laid[before];
    const along = a && b ? (axis(a, vertical) + axis(b, vertical)) / 2 : a ? axis(a, vertical) + step / 2 : axis(b!, vertical) - step / 2;
    const across = a && b ? (cross(a, vertical) + cross(b, vertical)) / 2 : cross((a ?? b)!, vertical);
    flags.push(
      vertical
        ? { turn: m.turn, kind: m.kind, letter, x: 322, y: along, from: across + 4, to: 304 }
        : { turn: m.turn, kind: m.kind, letter, x: along, y: 352, from: across + 4, to: 340 },
    );
  }

  return { vertical, width, height, path, guides: MOODS.map((mood) => ({ mood, pos: moodAt(mood) })), nodes: laid, flags };
}

const axis = (node: LaidNode, vertical: boolean) => (vertical ? node.y : node.x);
const cross = (node: LaidNode, vertical: boolean) => (vertical ? node.x : node.y);
