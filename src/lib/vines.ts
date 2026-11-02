/**
 * The living background: procedural vines on one fixed canvas.
 *
 * Vines grow in from the screen edges and sway. Near the pointer the leaves turn towards it and brighten, and shoots
 * sprout where it lingers. The foliage takes its colour from the character's mood, read from the --mood CSS variable
 * (1 hostile … 5 won over): ember leaves and thorns when it goes badly, sunlit leaves and blossoms when it goes well.
 */

export interface VineProps {
  seed?: number;
  /** 1 is the default amount of foliage. */
  density?: number;
  /** Rectangles the foliage is steered away from and dimmed inside, as fractions: "x0,y0,x1,y1;x0,y0,x1,y1". */
  avoid?: string;
}

export interface Zone {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Small seeded generator, so the same screen size always grows the same vines. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseZones(spec: string | undefined, w: number, h: number): Zone[] {
  const zones: Zone[] = [];
  for (const part of (spec ?? '').split(';')) {
    const n = part.split(',').map(parseFloat);
    if (n.length !== 4 || n.some((v) => Number.isNaN(v))) continue;
    const [x0, y0, x1, y1] = [n[0]! * w, n[1]! * h, n[2]! * w, n[3]! * h];
    zones.push({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: Math.max(20, (x1 - x0) / 2), hh: Math.max(20, (y1 - y0) / 2) });
  }
  return zones;
}

/** The faintest foliage gets behind content. */
export const ZONE_FLOOR = 0.14;

/** 1 outside the zones, ZONE_FLOOR well inside them, so foliage behind the content never fights the text. */
export function zoneDim(zones: Zone[], x: number, y: number): number {
  let f = 1;
  for (const z of zones) {
    const e = Math.max(Math.abs(x - z.cx) - z.hw, Math.abs(y - z.cy) - z.hh);
    const d = e < -8 ? ZONE_FLOOR : e < 56 ? ZONE_FLOOR + ((1 - ZONE_FLOOR) * (e + 8)) / 64 : 1;
    if (d < f) f = d;
  }
  return f;
}

/** Leaf hue, saturation and lightness for mood 1 … 5. */
const STOPS = [
  [9, 76, 47],
  [38, 70, 46],
  [88, 36, 38],
  [101, 52, 41],
  [79, 64, 48],
] as const;

export function leafColor(mood: number): [number, number, number] {
  const i = clamp(Math.floor(mood) - 1, 0, 3);
  const f = clamp(mood - 1 - i, 0, 1);
  const a = STOPS[i]!;
  const b = STOPS[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Asks the background to sprout a few shoots around the pointer, for example when a screen is left. */
export function burstVines() {
  window.dispatchEvent(new Event('vines:burst'));
}

interface Leaf {
  i: number;
  side: number;
  size: number;
  ang: number;
  ph: number;
  hj: number;
  lj: number;
  flower: boolean;
  thorn: boolean;
}

interface Path {
  xs: Float32Array;
  ys: Float32Array;
  cum: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  N: number;
  /** Points before the curl at the tip. */
  main: number;
  len: number;
}

interface Vine extends Path {
  /** Displacement of each point in the last frame, so shoots and branches can follow their parent. */
  dx: Float32Array;
  dy: Float32Array;
  X: Float32Array;
  Y: Float32Array;
  depth: number;
  w0: number;
  ph: number;
  sway: number;
  anchor: { p: Vine; i: number } | null;
  born: number | null;
  life: number;
  speed: number;
  delay: number;
  pre: number;
  grown: number;
  vis: number;
  shoots: number;
  alpha: number;
  leaves: Leaf[];
}

interface TraceOptions {
  step?: number;
  curl?: number;
  target?: { x: number; y: number };
}

interface VineOptions {
  depth: number;
  w0: number;
  speed: number;
  leaf: number;
  gap: number;
  delay?: number;
  pre?: number;
  anchor?: { p: Vine; i: number };
  born?: number;
  life?: number;
}

/** Back, middle and front layer: alpha, lightness, width and how far the layer slides with the pointer. */
const DEPTH = [
  { a: 0.6, l: 0.62, w: 0.6, par: -10 },
  { a: 0.82, l: 0.86, w: 0.86, par: 0 },
  { a: 0.97, l: 1.06, w: 1.16, par: 18 },
] as const;

const REACH = 210;
const TAU = Math.PI * 2;

const angleDiff = (a: number, b: number) => {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
};

export interface VineHandle {
  stop(): void;
}

export function startVines(cv: HTMLCanvasElement, read: () => VineProps): VineHandle {
  const ctx = cv.getContext('2d');
  if (!ctx) return { stop: () => undefined };
  const host = cv.ownerDocument.defaultView ?? window;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let dprCap = 1.75;
  let scale = 1;
  let vines: Vine[] = [];
  let shoots: Vine[] = [];
  let drawOrder: Vine[] = [];
  let zones: Zone[] = [];
  const motes: { x: number; y: number; r: number; v: number; ph: number; sp: number; d: number }[] = [];
  let raf = 0;
  let alive = true;
  let frameNo = 0;
  let sig = '';
  let drawn = false;
  let cost = 0;
  let slow = 0;
  const t0 = performance.now();
  const ptr = { x: -9999, y: -9999, tx: -9999, ty: -9999, last: -1e9, sx: -9999, sy: -9999, spawnAt: 0 };
  const par = { x: 0, y: 0 };
  let curMood = 3;
  let tgtMood = 3;
  let moodAt = -1e9;
  let moodSet = false;
  const rs = mulberry32(4242);
  const reduced = (() => {
    try {
      return host.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  })();

  function finish(xs: number[], ys: number[], main: number): Path {
    const N = xs.length;
    const px = Float32Array.from(xs);
    const py = Float32Array.from(ys);
    const cum = new Float32Array(N);
    const nx = new Float32Array(N);
    const ny = new Float32Array(N);
    for (let i = 1; i < N; i++) cum[i] = cum[i - 1]! + Math.hypot(px[i]! - px[i - 1]!, py[i]! - py[i - 1]!);
    for (let i = 0; i < N; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(N - 1, i + 1);
      const tx = px[b]! - px[a]!;
      const ty = py[b]! - py[a]!;
      const l = Math.hypot(tx, ty) || 1;
      nx[i] = -ty / l;
      ny[i] = tx / l;
    }
    return { xs: px, ys: py, cum, nx, ny, N, main, len: cum[N - 1]! };
  }

  function trace(rng: () => number, x0: number, y0: number, heading: number, len: number, o: TraceOptions): Path {
    const ds = o.step ?? 6;
    const n = clamp(Math.round(len / ds), 10, 700);
    const xs = [x0];
    const ys = [y0];
    let x = x0;
    let y = y0;
    let a = heading;
    const f1 = 0.04 + rng() * 0.03;
    const f2 = 0.1 + rng() * 0.06;
    const p1 = rng() * 6.28;
    const p2 = rng() * 6.28;
    const curl = o.curl ?? 1;
    for (let i = 1; i < n; i++) {
      a += (Math.sin(i * f1 + p1) * 0.085 + Math.sin(i * f2 + p2) * 0.05) * curl;
      if (o.target && i < n * 0.8) a += clamp(angleDiff(a, Math.atan2(o.target.y - y, o.target.x - x)), -0.07, 0.07);
      for (const z of zones) {
        const ux = (x - z.cx) / z.hw;
        const uy = (y - z.cy) / z.hh;
        const m = Math.max(Math.abs(ux), Math.abs(uy));
        if (m < 1) {
          const away = Math.abs(ux) > Math.abs(uy) ? (ux > 0 ? 0 : Math.PI) : uy > 0 ? Math.PI / 2 : -Math.PI / 2;
          a += clamp(angleDiff(a, away), -0.14, 0.14) * (1.2 - m) * 1.6;
        }
      }
      const out = (x < -30 && Math.cos(a) < 0) || (x > W + 30 && Math.cos(a) > 0) || (y < -30 && Math.sin(a) < 0) || (y > H + 30 && Math.sin(a) > 0);
      if (out) a += clamp(angleDiff(a, Math.atan2(H / 2 - y, W / 2 - x)), -0.1, 0.1);
      x += Math.cos(a) * ds;
      y += Math.sin(a) * ds;
      xs.push(x);
      ys.push(y);
    }
    const main = xs.length;
    // a curl at the tip
    const dir = rng() < 0.5 ? -1 : 1;
    const K = 30;
    const c0 = 0.1 + rng() * 0.04;
    for (let k = 1; k <= K; k++) {
      a += dir * (c0 + k * 0.013);
      const s2 = ds * 0.62 * (1 - k / (K * 1.12));
      x += Math.cos(a) * s2;
      y += Math.sin(a) * s2;
      xs.push(x);
      ys.push(y);
    }
    return finish(xs, ys, main);
  }

  function leavesFor(rng: () => number, p: Path, o: VineOptions): Leaf[] {
    const out: Leaf[] = [];
    const ds = p.len / (p.N - 1);
    let i = Math.round(34 / ds);
    let side = rng() < 0.5 ? 1 : -1;
    while (i < p.main - 2) {
      const s = i / p.main;
      const big = rng() < 0.2 ? 2.1 : 1;
      const size = o.leaf * (1.1 - 0.5 * s) * (0.75 + rng() * 0.6) * big;
      const leaf: Leaf = {
        i,
        side,
        size,
        ang: 0.62 + rng() * 0.55,
        ph: rng() * 6.28,
        hj: (rng() - 0.5) * 18,
        lj: (rng() - 0.5) * 9,
        flower: rng() < 0.22,
        thorn: rng() < 0.55,
      };
      out.push(leaf);
      if (rng() < 0.6) {
        out.push({ i, side: -side, size: size * (0.65 + rng() * 0.4), ang: leaf.ang + 0.12, ph: rng() * 6.28, hj: (rng() - 0.5) * 18, lj: (rng() - 0.5) * 9, flower: false, thorn: false });
      }
      side = -side;
      i += Math.max(3, Math.round((o.gap * (0.7 + rng() * 0.6)) / ds));
    }
    return out;
  }

  function mk(rng: () => number, p: Path, o: VineOptions): Vine {
    return {
      ...p,
      dx: new Float32Array(p.N),
      dy: new Float32Array(p.N),
      X: new Float32Array(p.N),
      Y: new Float32Array(p.N),
      depth: o.depth,
      w0: o.w0,
      ph: rng() * 6.28,
      sway: 0.7 + rng() * 0.6,
      anchor: o.anchor ?? null,
      born: o.born ?? null,
      life: o.life ?? 0,
      speed: o.speed,
      delay: o.delay ?? 0,
      pre: o.pre ?? 0.55,
      grown: 0,
      vis: 0,
      shoots: 0,
      alpha: 1,
      leaves: leavesFor(rng, p, o),
    };
  }

  function build() {
    const P = read();
    const rng = mulberry32((P.seed ?? 7) * 7919 + 13);
    const density = clamp(P.density ?? 1, 0.25, 2.2);
    scale = clamp(Math.sqrt(W * H) / 1150, 0.6, 1.8);
    zones = parseZones(P.avoid, W, H);
    shoots = [];
    motes.length = 0;
    const mains: Vine[] = [];
    const branches: Vine[] = [];
    const count = Math.round(clamp((W + H) / 165, 5, 18) * density);
    for (let i = 0; i < count; i++) {
      const r = rng();
      const side = r < 0.3 ? 0 : r < 0.58 ? 1 : r < 0.88 ? 2 : 3;
      let t = rng();
      t = rng() < 0.55 ? t * t : 1 - (1 - t) * (1 - t);
      let x: number;
      let y: number;
      let a: number;
      let lenK = 1;
      if (side === 0) {
        x = -14;
        y = t * H;
        a = (rng() - 0.5) * 0.8 + (t > 0.5 ? -0.45 : 0.45);
      } else if (side === 1) {
        x = W + 14;
        y = t * H;
        a = Math.PI + (rng() - 0.5) * 0.8 + (t > 0.5 ? 0.45 : -0.45);
      } else if (side === 2) {
        x = t * W;
        y = H + 14;
        a = -Math.PI / 2 + (rng() - 0.5) * 0.8 + (t < 0.5 ? 0.3 : -0.3);
      } else {
        x = t * W;
        y = -14;
        a = Math.PI / 2 + (rng() - 0.5) * 0.8 + (t < 0.5 ? -0.3 : 0.3);
        lenK = 0.7;
      }
      const len = (260 + rng() * 560) * scale * lenK;
      const depth = rng() < 0.3 ? 0 : rng() < 0.62 ? 1 : 2;
      const path = trace(rng, x, y, a, len, { curl: 0.8 + rng() * 0.7 });
      mains.push(mk(rng, path, { depth, w0: (4 + rng() * 2.6) * scale, speed: 95 + rng() * 60, delay: rng() * 1.2, leaf: 22 * scale, gap: 17 * scale }));
    }
    for (const p of mains) {
      const nb = 1 + Math.floor(rng() * 3);
      for (let b = 0; b < nb; b++) {
        const i = Math.floor(p.main * (0.28 + rng() * 0.5));
        const j = Math.min(p.N - 1, i + 1);
        const tangent = Math.atan2(p.ys[j]! - p.ys[i - 1]!, p.xs[j]! - p.xs[i - 1]!);
        const a = tangent + (rng() < 0.5 ? -1 : 1) * (0.7 + rng() * 0.45);
        const path = trace(rng, p.xs[i]!, p.ys[i]!, a, (110 + rng() * 170) * scale, { curl: 1.1, step: 5 });
        branches.push(mk(rng, path, { depth: p.depth, w0: p.w0 * 0.55, anchor: { p, i }, speed: 80 + rng() * 40, leaf: 16 * scale, gap: 15 * scale }));
      }
    }
    vines = mains.concat(branches);
    drawOrder = vines.slice().sort((a, b) => a.depth - b.depth);
    const motesCount = Math.round(clamp((W * H) / 26000, 14, 60) * density);
    for (let i = 0; i < motesCount; i++) motes.push({ x: rng() * W, y: rng() * H, r: 0.7 + rng() * 1.6, v: 4 + rng() * 12, ph: rng() * 6.28, sp: 0.4 + rng(), d: rng() });
  }

  function grow(v: Vine, time: number) {
    let g: number;
    if (v.born !== null) g = (time - v.born) * v.speed;
    else if (v.anchor) g = ((v.anchor.p.grown - v.anchor.p.cum[v.anchor.i]!) * v.speed) / v.anchor.p.speed;
    else g = v.len * v.pre + Math.max(0, time - v.delay) * v.speed;
    v.grown = clamp(g, 0, v.len);
    let n = v.vis;
    while (n < v.N && v.cum[n]! <= v.grown) n++;
    while (n > 0 && v.cum[n - 1]! > v.grown) n--;
    v.vis = n;
  }

  interface Look {
    h: number;
    s: number;
    l: number;
    spd: number;
    amp: number;
    bloom: number;
    thorn: number;
    px: number;
    py: number;
  }

  function pose(v: Vine, time: number, g: number, k: Look) {
    const D = DEPTH[v.depth]!;
    let ox = 0;
    let oy = 0;
    let px = k.px * D.par;
    let py = k.py * D.par;
    if (v.anchor) {
      ox = v.anchor.p.dx[v.anchor.i] ?? 0;
      oy = v.anchor.p.dy[v.anchor.i] ?? 0;
      px = 0;
      py = 0;
    }
    for (let i = 0; i < v.vis; i++) {
      const s = i / (v.N - 1);
      const amp = (2 + 4 * s + 12 * s * s) * k.amp * v.sway;
      const ph = time * k.spd * 0.85 + i * 0.065 + v.ph;
      const off = Math.sin(ph) * amp + Math.sin(ph * 1.7 + 1.3) * amp * 0.3;
      let x = v.xs[i]! + v.nx[i]! * off + ox + px;
      let y = v.ys[i]! + v.ny[i]! * off + oy + py;
      if (g > 0.01) {
        const ddx = ptr.x - x;
        const ddy = ptr.y - y;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 < REACH * REACH) {
          let f = 1 - Math.sqrt(d2) / REACH;
          f = f * f * 0.32 * g * (0.2 + 0.8 * s);
          x += ddx * f;
          y += ddy * f;
        }
      }
      v.X[i] = x;
      v.Y[i] = y;
      v.dx[i] = x - v.xs[i]!;
      v.dy[i] = y - v.ys[i]!;
    }
  }

  function paint(v: Vine, time: number, g: number, k: Look) {
    const n = v.vis;
    if (!ctx || n < 3) return;
    const D = DEPTH[v.depth]!;
    const { X, Y } = v;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = v.alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const bands = 5;
    const w0 = v.w0 * D.w;
    for (let b = 0; b < bands; b++) {
      const i0 = Math.floor(((n - 1) * b) / bands);
      const i1 = Math.min(n - 1, Math.floor(((n - 1) * (b + 1)) / bands) + 1);
      if (i1 <= i0) continue;
      const s = (i0 + i1) / 2 / (v.N - 1);
      let w = w0 * (1 - 0.86 * Math.pow(s, 0.85));
      if (b === bands - 1) w *= 0.7;
      ctx.lineWidth = Math.max(0.7, w);
      const mid = (i0 + i1) >> 1;
      ctx.globalAlpha = v.alpha * zoneDim(zones, X[mid]!, Y[mid]!);
      ctx.strokeStyle = `hsl(${(k.h - 6).toFixed(0)},${(k.s * 0.62).toFixed(0)}%,${clamp(k.l * 0.5 * D.l + s * 9, 6, 60).toFixed(1)}%)`;
      ctx.beginPath();
      ctx.moveTo(X[i0]!, Y[i0]!);
      for (let i = i0 + 1; i < i1; i++) ctx.quadraticCurveTo(X[i]!, Y[i]!, (X[i]! + X[i + 1]!) / 2, (Y[i]! + Y[i + 1]!) / 2);
      ctx.lineTo(X[i1]!, Y[i1]!);
      ctx.stroke();
    }
    for (const L of v.leaves) {
      const i = L.i;
      if (i >= n - 2 || i < 1) continue;
      let gf = clamp((v.grown - v.cum[i]!) / 70, 0, 1);
      gf = 1 - (1 - gf) * (1 - gf) * (1 - gf);
      if (gf <= 0.02) continue;
      const x = X[i]!;
      const y = Y[i]!;
      const tangent = Math.atan2(Y[i + 1]! - Y[i - 1]!, X[i + 1]! - X[i - 1]!);
      const da = D.a * zoneDim(zones, x, y);
      ctx.globalAlpha = v.alpha;
      const ang = tangent + L.side * L.ang + Math.sin(time * k.spd * 1.15 + L.ph) * 0.13 * k.amp;
      let lit = 0;
      if (g > 0.01) {
        const ddx = ptr.x - x;
        const ddy = ptr.y - y;
        lit = Math.pow(clamp(1 - Math.sqrt(ddx * ddx + ddy * ddy) / 270, 0, 1), 1.5) * g;
      }
      const size = L.size * gf * (1 + 0.16 * lit);
      const c = Math.cos(ang) * size;
      const s = Math.sin(ang) * size;
      ctx.setTransform(dpr * c, dpr * s, -dpr * s, dpr * c, dpr * x, dpr * y);
      const hh = k.h + L.hj;
      const lt = (k.l + L.lj) * D.l + lit * 21;
      ctx.fillStyle = `hsla(${hh.toFixed(0)},${k.s.toFixed(0)}%,${lt.toFixed(1)}%,${da.toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(0.2, -0.52, 0.78, -0.46, 1, 0);
      ctx.bezierCurveTo(0.78, 0.46, 0.2, 0.52, 0, 0);
      ctx.fill();
      ctx.fillStyle = `hsla(${(hh + 7).toFixed(0)},${(k.s + 6).toFixed(0)}%,${(lt + 11).toFixed(1)}%,${(da * 0.42).toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(0.2, -0.52, 0.78, -0.46, 1, 0);
      ctx.lineTo(0.06, 0);
      ctx.fill();
      ctx.strokeStyle = `rgba(236,246,190,${(0.16 + lit * 0.3).toFixed(2)})`;
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(0.05, 0);
      ctx.lineTo(0.88, 0);
      ctx.stroke();
      const flower = L.flower && k.bloom > 0.03;
      const thorn = L.thorn && k.thorn > 0.03;
      if (!flower && !thorn) continue;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (flower) {
        const fr = 5.2 * scale * gf * k.bloom * (1 + lit * 0.5);
        const fx = x + v.nx[i]! * L.side * 8;
        const fy = y + v.ny[i]! * L.side * 8;
        ctx.fillStyle = `rgba(250,242,208,${(0.92 * k.bloom * da).toFixed(2)})`;
        for (let q = 0; q < 5; q++) {
          const qa = q * 1.2566 + L.ph;
          ctx.beginPath();
          ctx.arc(fx + Math.cos(qa) * fr * 0.95, fy + Math.sin(qa) * fr * 0.95, fr * 0.62, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(255,178,52,${(k.bloom * da).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(fx, fy, fr * 0.42, 0, TAU);
        ctx.fill();
      }
      if (thorn) {
        const tx = v.nx[i]! * 6 * scale;
        const ty = v.ny[i]! * 6 * scale;
        ctx.strokeStyle = `rgba(240,96,60,${(0.85 * k.thorn * da).toFixed(2)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x - tx * 0.2, y - ty * 0.2);
        ctx.lineTo(x - tx, y - ty);
        ctx.moveTo(x + tx * 0.2, y + ty * 0.2);
        ctx.lineTo(x + tx, y + ty);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** A shoot grows from the vine point nearest to (tx, ty) towards it. */
  function spawn(time: number, tx: number, ty: number): boolean {
    let best: Vine | null = null;
    let bd = 1e12;
    let bi = 0;
    for (const v of vines) {
      if (v.shoots >= 4) continue;
      const m = Math.min(v.vis, v.main) - 4;
      for (let i = 10; i < m; i += 3) {
        const dx = v.X[i]! - tx;
        const dy = v.Y[i]! - ty;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = v;
          bi = i;
        }
      }
    }
    if (!best || bd > 300 * 300 || bd < 24 * 24) return false;
    const heading = Math.atan2(ty - best.Y[bi]!, tx - best.X[bi]!) + (rs() - 0.5) * 0.8;
    const path = trace(rs, best.xs[bi]!, best.ys[bi]!, heading, clamp(Math.sqrt(bd) * 1.1 + 40, 90, 230) * Math.sqrt(scale), {
      target: { x: tx - best.dx[bi]!, y: ty - best.dy[bi]! },
      curl: 0.5,
      step: 5,
    });
    shoots.push(mk(rs, path, { depth: best.depth, w0: 2.4 * scale, anchor: { p: best, i: bi }, born: time, speed: 150, life: 12 + rs() * 6, leaf: 10 * scale, gap: 19 * scale }));
    best.shoots++;
    if (shoots.length > 26) {
      const old = shoots.shift()!;
      if (old.anchor) old.anchor.p.shoots = Math.max(0, old.anchor.p.shoots - 1);
    }
    return true;
  }

  function resize(): boolean {
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (!w || !h) return false;
    const P = read();
    const next = `${w}x${h}|${P.seed}|${P.density}|${P.avoid}`;
    const ratio = Math.min(host.devicePixelRatio || 1, dprCap);
    if (next === sig && ratio === dpr) return true;
    const rebuild = next !== sig;
    sig = next;
    W = w;
    H = h;
    dpr = ratio;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    if (rebuild) build();
    drawn = false;
    return true;
  }

  function readMood(now: number) {
    if (now - moodAt < 140) return;
    moodAt = now;
    const m = parseFloat(host.getComputedStyle(cv).getPropertyValue('--mood'));
    tgtMood = clamp(Number.isNaN(m) ? 3 : m, 1, 5);
    if (!moodSet) {
      curMood = tgtMood;
      moodSet = true;
    }
  }

  function frame(now: number) {
    if (!alive) return;
    raf = host.requestAnimationFrame(frame);
    frameNo++;
    const idle = now - ptr.last > 3000;
    if (reduced && drawn) return;
    if (idle && frameNo % 2 === 1 && !reduced) return;
    if (!resize() || !ctx) return;
    const began = performance.now();
    readMood(now);
    curMood += (tgtMood - curMood) * 0.06;
    const time = reduced ? 9 : (now - t0) / 1000;
    const g = reduced ? 0 : clamp(1 - (now - ptr.last - 1200) / 3600, 0, 1);
    ptr.x += (ptr.tx - ptr.x) * 0.16;
    ptr.y += (ptr.ty - ptr.y) * 0.16;
    par.x += ((g > 0 ? clamp(ptr.tx / W - 0.5, -0.5, 0.5) : 0) - par.x) * 0.05;
    par.y += ((g > 0 ? clamp(ptr.ty / H - 0.5, -0.5, 0.5) : 0) - par.y) * 0.05;
    const m = curMood;
    const [h, s, l] = leafColor(m);
    const k: Look = {
      h,
      s,
      l,
      spd: m < 3 ? 1 + (3 - m) * 0.42 : 1 - (m - 3) * 0.16,
      amp: m < 3 ? 1 + (3 - m) * 0.3 : 1,
      bloom: clamp((m - 3.6) / 1.0, 0, 1),
      thorn: clamp((2.5 - m) / 1.0, 0, 1),
      px: par.x,
      py: par.y,
    };
    // a shoot sprouts where the pointer lingers and a vine is close
    if (g > 0.4 && now > ptr.spawnAt) {
      const dx = ptr.tx - ptr.sx;
      const dy = ptr.ty - ptr.sy;
      if (dx * dx + dy * dy > 34 * 34) {
        if (spawn(time, ptr.tx, ptr.ty)) {
          ptr.sx = ptr.tx;
          ptr.sy = ptr.ty;
          ptr.spawnAt = now + 230;
        } else ptr.spawnAt = now + 120;
      }
    }
    for (let i = shoots.length - 1; i >= 0; i--) {
      const sh = shoots[i]!;
      const age = time - (sh.born ?? 0);
      if (age > sh.life) {
        if (sh.anchor) sh.anchor.p.shoots = Math.max(0, sh.anchor.p.shoots - 1);
        shoots.splice(i, 1);
        continue;
      }
      sh.alpha = clamp((sh.life - age) / 3, 0, 1);
    }
    const all = vines.concat(shoots);
    for (const v of all) grow(v, time);
    for (const v of all) pose(v, time, g, k);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // drifting motes: sparks when it goes badly, pollen when it goes well
    const moteHue = m < 2.5 ? 18 : m > 4 ? 52 : 74;
    for (const o of motes) {
      const yy = ((((o.y - time * o.v * (m < 2.5 ? 1.8 : 1)) % (H + 20)) + H + 20) % (H + 20)) - 10;
      const xx = o.x + Math.sin(time * 0.35 * o.sp + o.ph) * 16 + par.x * (o.d - 0.5) * 40;
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.9 * o.sp + o.ph));
      let near = 0;
      if (g > 0.01) {
        const ddx = ptr.x - xx;
        const ddy = ptr.y - yy;
        near = clamp(1 - Math.sqrt(ddx * ddx + ddy * ddy) / 220, 0, 1) * g;
      }
      ctx.fillStyle = `hsla(${moteHue},85%,70%,${(0.18 * twinkle * (0.5 + o.d) + near * 0.5).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(xx, yy, o.r * (1 + near), 0, TAU);
      ctx.fill();
    }
    // vines back to front; a shoot shares the layer of its parent
    for (const v of drawOrder.concat(shoots).sort((a, b) => a.depth - b.depth)) paint(v, time, g, k);
    // light that follows the pointer
    if (g > 0.02) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const light = m < 2.5 ? 22 : m > 4 ? 70 : 82;
      const rg = ctx.createRadialGradient(ptr.x, ptr.y, 0, ptr.x, ptr.y, 230);
      rg.addColorStop(0, `hsla(${light},90%,66%,${(0.14 * g).toFixed(3)})`);
      rg.addColorStop(0.5, `hsla(${light},90%,66%,${(0.04 * g).toFixed(3)})`);
      rg.addColorStop(1, `hsla(${light},90%,66%,0)`);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rg;
      ctx.fillRect(ptr.x - 230, ptr.y - 230, 460, 460);
      ctx.globalCompositeOperation = 'source-over';
    }
    drawn = true;
    // a slow machine draws at the native pixel ratio instead of 1.75
    cost = cost * 0.9 + (performance.now() - began) * 0.1;
    slow = cost > 10 && dprCap > 1 ? slow + 1 : 0;
    if (slow > 45) dprCap = 1;
  }

  const toLocal = (e: PointerEvent): [number, number] => {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) * (W / (r.width || 1)), (e.clientY - r.top) * (H / (r.height || 1))];
  };
  const onMove = (e: PointerEvent) => {
    const [x, y] = toLocal(e);
    if (ptr.last < -1e8) {
      ptr.x = x;
      ptr.y = y;
      ptr.sx = x;
      ptr.sy = y;
    }
    ptr.tx = x;
    ptr.ty = y;
    ptr.last = performance.now();
  };
  const sprout = (x: number, y: number, count: number) => {
    const time = (performance.now() - t0) / 1000;
    for (let i = 0; i < count; i++) spawn(time, x + (rs() - 0.5) * 120, y + (rs() - 0.5) * 120);
    ptr.last = performance.now();
  };
  const onDown = (e: PointerEvent) => {
    const [x, y] = toLocal(e);
    sprout(x, y, 4);
  };
  const onBurst = () => {
    if (ptr.tx > -1000) sprout(ptr.tx, ptr.ty, 6);
  };
  const onLeave = () => {
    ptr.last = -1e9;
  };
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerdown', onDown, { passive: true });
  host.addEventListener('vines:burst', onBurst);
  host.document.documentElement.addEventListener('pointerleave', onLeave);
  raf = host.requestAnimationFrame(frame);

  return {
    stop() {
      alive = false;
      host.cancelAnimationFrame(raf);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('vines:burst', onBurst);
      host.document.documentElement.removeEventListener('pointerleave', onLeave);
    },
  };
}
