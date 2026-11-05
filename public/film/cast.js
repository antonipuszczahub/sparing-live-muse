// Flat-vector people for the film: one parametric renderer, many looks. Origin = the base of the neck, +y is down.
// Everything is canvas paths with soft gradients, no images and no libraries. Hair is painted once into a cached layer.

const TAU = Math.PI * 2;
const S_PATH = 'M46 8 C32 9 20 16 16.5 29 A6 6 0 0 0 22.5 35 L47.5 31.5 C41 44 24 52 10 56.5';

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ell = (c, x, y, rx, ry, fill, rot = 0) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
  c.fillStyle = fill;
  c.fill();
};

function rrect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

const poly = (c, pts, fill) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
};

const lin = (c, x0, y0, x1, y1, stops) => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  return g;
};

/* ---------- cached layers (hair, stubble) ---------- */

const CACHE = new Map();
const LAYER = { x: -230, y: -340, w: 460, h: 480, k: 2 };

function layer(P, name, paint) {
  const key = `${P.name}:${name}`;
  let cv = CACHE.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = LAYER.w * LAYER.k;
    cv.height = LAYER.h * LAYER.k;
    const g = cv.getContext('2d');
    g.scale(LAYER.k, LAYER.k);
    g.translate(-LAYER.x, -LAYER.y);
    paint(g, P);
    CACHE.set(key, cv);
  }
  return cv;
}

const blit = (c, cv) => c.drawImage(cv, LAYER.x, LAYER.y, LAYER.w, LAYER.h);

/* ---------- hair ---------- */

function curlBall(c, x, y, r, tone, base) {
  const g = c.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r * 1.06);
  g.addColorStop(0, shade(base, 0.24 + tone * 0.1));
  g.addColorStop(0.5, shade(base, 0.02 + (tone - 0.5) * 0.12));
  g.addColorStop(1, shade(base, -0.3));
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = g;
  c.fill();
  // the spiral of the curl
  c.lineCap = 'round';
  c.strokeStyle = shade(base, -0.42);
  c.globalAlpha = 0.3;
  c.lineWidth = Math.max(2, r * 0.12);
  const a0 = 3.4 + tone * 2.2;
  c.beginPath();
  c.arc(x + r * 0.06, y + r * 0.05, r * 0.56, a0, a0 + 4.1);
  c.stroke();
  c.beginPath();
  c.arc(x + r * 0.04, y + r * 0.02, r * 0.26, a0 + 1.6, a0 + 5);
  c.stroke();
  c.globalAlpha = 0.32;
  c.strokeStyle = shade(base, 0.5);
  c.lineWidth = Math.max(1.6, r * 0.09);
  c.beginPath();
  c.arc(x, y, r * 0.8, 3.7, 4.5);
  c.stroke();
  c.globalAlpha = 1;
}

function curlSet(seed) {
  const r = rng(seed);
  const back = [];
  for (let i = 0; i < 38; i++) {
    const a = Math.PI * (0.98 + (i / 37) * 1.04);
    const rad = 1 + (r() - 0.5) * 0.14;
    back.push({ x: Math.cos(a) * 100 * rad, y: -184 + Math.sin(a) * 108 * rad, r: 24 + r() * 14, tone: r() });
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 9; i++) back.push({ x: s * (84 + r() * 22 + i * 1.4), y: -176 + i * 13 + r() * 8, r: 19 + r() * 10, tone: r() });
  }
  back.sort((a, b) => a.y - b.y);
  const front = [];
  for (let i = 0; i < 13; i++) {
    const x = -72 + (i / 12) * 144 + (r() - 0.5) * 8;
    front.push({ x, y: -240 + Math.abs(x) * 0.26 + (r() - 0.5) * 8, r: 20 + r() * 10, tone: r() });
  }
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) front.push({ x: s * (70 + i * 3), y: -218 + i * 15, r: 13 + r() * 6, tone: r() });
  for (const x of [-34, -6, 22, 46]) front.push({ x: x + (r() - 0.5) * 6, y: -222 + r() * 8, r: 11 + r() * 5, tone: r() });
  return { back, front };
}

function hairBackPaint(c, P) {
  const h = P.hair;
  if (P.style === 'curly') {
    const set = curlSet(P.seed ?? 7);
    ell(c, 0, -188, 98, 106, lin(c, 0, -300, 0, -90, [[0, shade(h, 0.1)], [1, shade(h, -0.3)]]));
    for (const k of set.back) curlBall(c, k.x, k.y, k.r, k.tone, h);
  } else if (P.style === 'wavy') {
    c.beginPath();
    c.moveTo(-86, -196);
    c.bezierCurveTo(-120, -274, 120, -274, 86, -196);
    c.bezierCurveTo(114, -150, 98, -70, 116, 8);
    c.bezierCurveTo(70, 28, 40, -20, 0, -20);
    c.bezierCurveTo(-40, -20, -70, 28, -116, 8);
    c.bezierCurveTo(-98, -70, -114, -150, -86, -196);
    c.closePath();
    c.fillStyle = lin(c, -100, -260, 100, 10, [[0, shade(h, 0.04)], [1, shade(h, -0.3)]]);
    c.fill();
  } else if (P.style === 'bun') {
    curlBall(c, 0, -290, 31, 0.4, '#3d3132');
  }
}

function hairFrontPaint(c, P) {
  const h = P.hair;
  if (P.style === 'curly') {
    const set = curlSet(P.seed ?? 7);
    for (const k of set.front) curlBall(c, k.x, k.y, k.r, k.tone, h);
  } else if (P.style === 'wavy') {
    c.beginPath();
    c.moveTo(-82, -166);
    c.bezierCurveTo(-90, -254, -24, -282, 22, -272);
    c.bezierCurveTo(74, -264, 90, -222, 82, -166);
    c.bezierCurveTo(76, -208, 44, -232, 2, -228);
    c.bezierCurveTo(-36, -224, -68, -204, -82, -166);
    c.closePath();
    c.fillStyle = lin(c, -80, -280, 80, -180, [[0, shade(h, 0.16)], [1, shade(h, -0.14)]]);
    c.fill();
    c.strokeStyle = shade(h, 0.28);
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-50, -244);
    c.quadraticCurveTo(-10, -266, 36, -256);
    c.stroke();
  } else if (P.style === 'short' || P.style === 'bun') {
    c.beginPath();
    c.moveTo(-81, -166);
    c.bezierCurveTo(-86, -254, -40, -274, 0, -274);
    c.bezierCurveTo(40, -274, 86, -254, 81, -166);
    c.bezierCurveTo(74, -200, 54, -224, 0, -226);
    c.bezierCurveTo(-54, -224, -74, -200, -81, -166);
    c.closePath();
    c.fillStyle = lin(c, -60, -280, 60, -200, [[0, shade(h, 0.2)], [1, shade(h, -0.12)]]);
    c.fill();
    c.strokeStyle = shade(h, 0.3);
    c.lineWidth = 3.5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-40, -252);
    c.quadraticCurveTo(0, -264, 38, -250);
    c.stroke();
  } else if (P.style === 'sides') {
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 70, -234);
      c.bezierCurveTo(s * 98, -224, s * 98, -170, s * 80, -148);
      c.lineTo(s * 74, -192);
      c.closePath();
      c.fillStyle = lin(c, 0, -240, 0, -150, [[0, shade(h, 0.12)], [1, shade(h, -0.15)]]);
      c.fill();
    }
    c.beginPath();
    c.moveTo(-68, -238);
    c.bezierCurveTo(-30, -270, 30, -270, 68, -238);
    c.bezierCurveTo(30, -248, -30, -248, -68, -238);
    c.fillStyle = shade(h, -0.04);
    c.fill();
  }
}

function beardPath(c) {
  c.beginPath();
  c.moveTo(-77, -166);
  c.bezierCurveTo(-79, -118, -50, -84, 0, -78);
  c.bezierCurveTo(50, -84, 79, -118, 77, -166);
  c.bezierCurveTo(70, -140, 56, -134, 42, -132);
  c.quadraticCurveTo(0, -148, -42, -132);
  c.bezierCurveTo(-56, -134, -70, -140, -77, -166);
  c.closePath();
}

function beardPaint(c, P) {
  if (!P.beard) return;
  const col = P.beard.color;
  c.save();
  c.globalAlpha = P.beard.alpha ?? 1;
  beardPath(c);
  c.fillStyle = lin(c, 0, -150, 0, -76, [[0, shade(col, 0.06)], [1, shade(col, -0.18)]]);
  c.fill();
  c.restore();
  if ((P.beard.alpha ?? 1) > 0.6) {
    c.beginPath();
    c.moveTo(-38, -139);
    c.quadraticCurveTo(0, -155, 38, -139);
    c.quadraticCurveTo(20, -125, 0, -131);
    c.quadraticCurveTo(-20, -125, -38, -139);
    c.fillStyle = shade(col, -0.08);
    c.fill();
  }
}

function stubblePaint(c, P) {
  if (!P.stubble) return;
  c.save();
  beardPath(c);
  c.clip();
  c.globalAlpha = P.stubble;
  c.fillStyle = shade(P.hair, -0.1);
  c.fillRect(-90, -170, 180, 100);
  c.restore();
}

/* ---------- body ---------- */

function torsoPath(c) {
  c.beginPath();
  c.moveTo(-190, 420);
  c.lineTo(-186, 124);
  c.bezierCurveTo(-184, 62, -140, 26, -64, 16);
  c.lineTo(64, 16);
  c.bezierCurveTo(140, 26, 184, 62, 186, 124);
  c.lineTo(190, 420);
  c.closePath();
}

function torso(c, fill) {
  torsoPath(c);
  c.fillStyle = fill;
  c.fill();
  // light from the upper left
  c.save();
  torsoPath(c);
  c.clip();
  c.fillStyle = lin(c, -190, 0, 190, 0, [[0, 'rgba(255,255,255,0.13)'], [0.45, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.22)']]);
  c.fillRect(-200, 0, 400, 430);
  c.fillStyle = lin(c, 0, 16, 0, 300, [[0, 'rgba(0,0,0,0.0)'], [1, 'rgba(0,0,0,0.2)']]);
  c.fillRect(-200, 0, 400, 430);
  c.restore();
}

function neck(c, P) {
  const skinD = shade(P.skin, -0.16);
  rrect(c, -27, -100, 54, 132, 20);
  c.fillStyle = P.skin;
  c.fill();
  c.save();
  rrect(c, -27, -100, 54, 132, 20);
  c.clip();
  ell(c, 0, -80, 58, 34, skinD); // the shadow of the chin
  c.fillStyle = lin(c, -27, 0, 27, 0, [[0, 'rgba(255,255,255,0.08)'], [1, 'rgba(0,0,0,0.1)']]);
  c.fillRect(-30, -100, 60, 140);
  c.restore();
}

function outfit(c, P) {
  const cl = P.cloth;
  const dark = shade(cl, -0.22);
  const light = shade(cl, 0.2);
  if (P.outfit === 'hoodie') {
    ell(c, 0, 6, 126, 60, lin(c, 0, -50, 0, 70, [[0, shade(cl, -0.04)], [1, shade(cl, -0.36)]])); // the hood on the shoulders
    torso(c, cl);
    ell(c, 0, 2, 48, 26, shade(cl, -0.66)); // the dark inside of the hood
    neck(c, P);
    c.lineCap = 'round';
    c.strokeStyle = shade(cl, -0.2);
    c.lineWidth = 36;
    c.beginPath();
    c.arc(0, -10, 63, 0.14 * Math.PI, 0.86 * Math.PI);
    c.stroke();
    c.strokeStyle = shade(cl, 0.2);
    c.lineWidth = 4.5;
    c.beginPath();
    c.arc(0, -10, 46, 0.18 * Math.PI, 0.82 * Math.PI);
    c.stroke();
    // drawstrings
    for (const s of [-1, 1]) {
      c.strokeStyle = 'rgba(0,0,0,0.18)';
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(s * 22, 54);
      c.quadraticCurveTo(s * 30, 92, s * 25, 134);
      c.stroke();
      c.strokeStyle = '#f6f6f8';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(s * 21, 52);
      c.quadraticCurveTo(s * 28, 90, s * 23, 132);
      c.stroke();
      ell(c, s * 23, 138, 4.6, 8, '#f6f6f8');
    }
    // the S of the app on the chest
    c.save();
    c.translate(-27, 150);
    c.scale(0.95, 0.95);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = 12;
    c.strokeStyle = '#ff7a45';
    c.stroke(new Path2D(S_PATH));
    c.restore();
    // folds of the fabric
    c.strokeStyle = shade(cl, -0.16);
    c.lineWidth = 3.2;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 128, 76);
      c.quadraticCurveTo(s * 104, 140, s * 118, 226);
      c.stroke();
      c.beginPath();
      c.moveTo(s * 70, 108);
      c.quadraticCurveTo(s * 86, 160, s * 76, 230);
      c.stroke();
    }
  } else if (P.outfit === 'blazer') {
    torso(c, cl);
    neck(c, P);
    poly(c, [[-46, 12], [46, 12], [0, 156]], P.inner);
    poly(c, [[-46, 12], [-128, 54], [-38, 196], [-8, 134]], light);
    poly(c, [[46, 12], [128, 54], [38, 196], [8, 134]], light);
    c.strokeStyle = dark;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-46, 12);
    c.lineTo(-8, 134);
    c.moveTo(46, 12);
    c.lineTo(8, 134);
    c.stroke();
    ell(c, 56, 90, 6, 6, '#e9d28b'); // a small pin
  } else if (P.outfit === 'tweed') {
    torso(c, cl);
    c.save();
    torsoPath(c);
    c.clip();
    c.globalAlpha = 0.14;
    c.fillStyle = '#000';
    for (let y = 40; y < 420; y += 14) for (let x = -190 + ((y / 14) % 2) * 7; x < 190; x += 14) c.fillRect(x, y, 3, 3);
    c.restore();
    neck(c, P);
    poly(c, [[-44, 12], [44, 12], [0, 146]], '#f1efe9');
    poly(c, [[-44, 12], [-12, 46], [-48, 58]], '#ffffff');
    poly(c, [[44, 12], [12, 46], [48, 58]], '#ffffff');
    poly(c, [[-12, 30], [12, 30], [6, 54], [0, 60], [-6, 54]], P.tie);
    poly(c, [[-7, 58], [7, 58], [15, 176], [0, 190], [-15, 176]], P.tie);
    poly(c, [[-46, 12], [-126, 54], [-40, 200], [-10, 146]], dark);
    poly(c, [[46, 12], [126, 54], [40, 200], [10, 146]], dark);
  } else if (P.outfit === 'blouse') {
    torso(c, cl);
    neck(c, P);
    poly(c, [[-48, 12], [48, 12], [0, 100]], P.skin);
    poly(c, [[-48, 12], [-8, 104], [-74, 62]], light);
    poly(c, [[48, 12], [8, 104], [74, 62]], light);
    c.strokeStyle = dark;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-48, 12);
    c.lineTo(-8, 104);
    c.moveTo(48, 12);
    c.lineTo(8, 104);
    c.stroke();
    ell(c, 0, 112, 6, 6, '#e9cd78');
    c.strokeStyle = '#e9cd78';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 30, 46, 0.2 * Math.PI, 0.8 * Math.PI);
    c.stroke();
  } else {
    torso(c, cl);
    neck(c, P);
    poly(c, [[-46, 12], [0, 42], [-28, 78], [-66, 30]], light);
    poly(c, [[46, 12], [0, 42], [28, 78], [66, 30]], light);
    c.strokeStyle = dark;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 42);
    c.lineTo(0, 420);
    c.stroke();
    for (let y = 96; y < 400; y += 62) ell(c, 9, y, 4.6, 4.6, dark);
  }
}

function oneArm(c, P, g, wob) {
  const sx = 126;
  const sy = 60;
  const hx = 120 + g * 58 + wob;
  const hy = 214 - g * 236;
  const ex = 156 + g * 24;
  const ey = 176 - g * 76;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = shade(P.cloth, -0.12);
  c.lineWidth = 56;
  c.beginPath();
  c.moveTo(sx, sy);
  c.lineTo(ex, ey);
  c.lineTo(hx, hy + 28);
  c.stroke();
  c.strokeStyle = P.cloth;
  c.lineWidth = 50;
  c.stroke();
  c.strokeStyle = shade(P.cloth, 0.18);
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(sx - 12, sy + 8);
  c.lineTo(ex - 14, ey);
  c.stroke();
  // the cuff
  ell(c, hx, hy + 30, 26, 11, shade(P.cloth, -0.25), Math.atan2(hy + 28 - ey, hx - ex) + Math.PI / 2);
  // the hand
  const skinD = shade(P.skin, -0.14);
  ell(c, hx, hy, 25, 28, P.skin);
  for (let i = 0; i < 4; i++) {
    const a = -1.95 + i * 0.43;
    ell(c, hx + Math.cos(a) * 23, hy + Math.sin(a) * 26, 8.8, 13, P.skin, a + Math.PI / 2);
  }
  ell(c, hx - 25, hy + 6, 8.4, 15, P.skin, -0.7);
  c.strokeStyle = skinD;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(hx, hy + 4, 15, 0.4, 2.4);
  c.stroke();
}

function arms(c, P, g, wob, g2) {
  if (g2 > 0.02) {
    c.save();
    c.scale(-1, 1);
    oneArm(c, P, g2, 0);
    c.restore();
  }
  if (g > 0.02) oneArm(c, P, g, wob);
}

/* ---------- face ---------- */

function eye(c, P, s, blink, look) {
  const x = s * 31 + look.x * 3;
  const y = -168 + look.y * 2;
  const rx = 15.5;
  const ry = Math.max(1.4, 13.5 * (1 - blink * 0.94));
  c.save();
  c.beginPath();
  c.ellipse(s * 31, -168, rx, ry, 0, 0, TAU);
  c.fillStyle = lin(c, 0, -182, 0, -154, [[0, '#e9edf2'], [0.35, '#ffffff'], [1, '#f6f6f6']]);
  c.fill();
  c.clip();
  const ix = x + look.x * 3;
  const gr = c.createRadialGradient(ix - 2, y - 2, 1, ix, y, 10);
  gr.addColorStop(0, shade(P.eye, 0.35));
  gr.addColorStop(0.55, P.eye);
  gr.addColorStop(1, shade(P.eye, -0.5));
  ell(c, ix, y, 9.2, 9.2, gr);
  ell(c, ix, y, 4.4, 4.4, '#0d1018');
  ell(c, ix - 3, y - 3.4, 2.7, 2.7, 'rgba(255,255,255,0.95)');
  ell(c, ix + 3, y + 3, 1.3, 1.3, 'rgba(255,255,255,0.55)');
  // the shadow the upper lid throws
  c.fillStyle = 'rgba(0,0,0,0.12)';
  c.fillRect(s * 31 - 20, -183, 40, 10);
  c.restore();
  // upper lid
  c.strokeStyle = shade(P.skin, -0.62);
  c.lineWidth = P.lashes ? 4.2 : 3.4;
  c.lineCap = 'round';
  c.beginPath();
  c.ellipse(s * 31, -168, rx, ry, 0, Math.PI * 1.03, Math.PI * 1.97);
  c.stroke();
  if (P.lashes) {
    c.lineWidth = 2.4;
    for (let i = 0; i < 2; i++) {
      c.beginPath();
      c.moveTo(s * 31 + s * (rx - 1 + i * -0.2), -168 - ry * (0.35 + i * 0.1));
      c.lineTo(s * 31 + s * (rx + 6 - i), -168 - ry * (0.65 + i * 0.12) - 3);
      c.stroke();
    }
  }
  // the crease above the lid
  if (blink < 0.4) {
    c.strokeStyle = shade(P.skin, -0.28);
    c.globalAlpha = 0.5;
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(s * 31, -171, rx - 1, ry + 4, 0, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
    c.globalAlpha = 1;
  }
}

function brows(c, P, mood, raise, tilt) {
  const col = P.browColor ?? shade(P.hair, -0.18);
  const th = P.thickBrows ? 9 : 7;
  const worry = mood < -0.2 ? -mood : 0;
  c.fillStyle = col;
  for (const s of [-1, 1]) {
    const lift = raise * 9 * (s === 1 ? 1 + tilt : 1 - tilt);
    const y = -198 - lift;
    const ix = s * 12;
    const iy = y + 5 - worry * 6;
    const mx = s * 34;
    const my = y - 6;
    const ox = s * 56;
    const oy = y + 4 + worry * 3;
    c.beginPath();
    c.moveTo(ix, iy - th * 0.45);
    c.quadraticCurveTo(mx, my - th * 0.6, ox, oy - th * 0.1);
    c.quadraticCurveTo(mx, my + th * 0.5, ix, iy + th * 0.55);
    c.closePath();
    c.fill();
  }
}

function nose(c, P) {
  const skinD = shade(P.skin, -0.22);
  ell(c, 7, -141, 10, 5.4, 'rgba(0,0,0,0.07)');
  ell(c, -1, -160, 3.4, 9, 'rgba(255,255,255,0.11)');
  c.strokeStyle = skinD;
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-3, -157);
  c.quadraticCurveTo(8, -143, 2, -138);
  c.stroke();
  ell(c, -3, -137, 2.4, 1.6, 'rgba(60,20,10,0.35)');
  ell(c, 8, -139, 2.4, 1.6, 'rgba(60,20,10,0.35)');
}

function mouth(c, P, open, mood) {
  const y = -116;
  const w = 26 + open * 4 + Math.max(0, mood) * 5;
  const smile = mood * 11;
  const lip = P.lip ?? '#c4605b';
  // smile lines
  if (mood > 0.28) {
    c.strokeStyle = shade(P.skin, -0.2);
    c.globalAlpha = Math.min(0.55, (mood - 0.2) * 1.4);
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * (w + 3), y - 15);
      c.quadraticCurveTo(s * (w + 12), y - 5, s * (w + 5), y + 5);
      c.stroke();
    }
    c.globalAlpha = 1;
  }
  if (open < 0.07) {
    c.strokeStyle = lip;
    c.lineWidth = 5.4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-w, y - smile * 0.18);
    c.quadraticCurveTo(0, y + 2 + smile, w, y - smile * 0.18);
    c.stroke();
    c.strokeStyle = shade(lip, 0.25);
    c.globalAlpha = 0.45;
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(-w * 0.55, y + 5 + smile * 0.55);
    c.quadraticCurveTo(0, y + 7 + smile * 0.9, w * 0.55, y + 5 + smile * 0.55);
    c.stroke();
    c.globalAlpha = 1;
    return;
  }
  const dn = 6 + open * 32;
  c.beginPath();
  c.moveTo(-w, y);
  c.quadraticCurveTo(0, y - 3 + smile * 0.2, w, y);
  c.quadraticCurveTo(w * 0.72, y + dn * 1.15, 0, y + dn * 1.22);
  c.quadraticCurveTo(-w * 0.72, y + dn * 1.15, -w, y);
  c.closePath();
  c.fillStyle = '#35151a';
  c.fill();
  c.save();
  c.clip();
  if (open > 0.2) {
    c.fillStyle = '#fbfaf8';
    c.fillRect(-w, y - 3, w * 2, 8 + open * 5);
    c.strokeStyle = 'rgba(0,0,0,0.12)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(0, y - 2);
    c.lineTo(0, y + 6 + open * 4);
    c.stroke();
  }
  ell(c, 0, y + dn * 1.16, w * 0.58, dn * 0.5, '#d9736f');
  c.restore();
  c.strokeStyle = lip;
  c.lineWidth = 4.2;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-w, y);
  c.quadraticCurveTo(0, y - 3 + smile * 0.2, w, y);
  c.stroke();
  // the lower lip
  c.strokeStyle = shade(lip, 0.12);
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(-w * 0.62, y + dn * 0.98);
  c.quadraticCurveTo(0, y + dn * 1.32 + 3, w * 0.62, y + dn * 0.98);
  c.stroke();
}

function glasses(c, P, glint) {
  if (!P.glasses) return;
  c.lineJoin = 'round';
  for (const s of [-1, 1]) {
    const cx = s * 31;
    rrect(c, cx - 26, -168 - 21, 52, 42, P.roundGlasses ? 21 : 13);
    c.fillStyle = 'rgba(190,220,255,0.08)';
    c.fill();
    c.strokeStyle = P.glasses;
    c.lineWidth = 5;
    c.stroke();
    c.save();
    rrect(c, cx - 26, -168 - 21, 52, 42, P.roundGlasses ? 21 : 13);
    c.clip();
    // a glint that slides across the lens
    const gx = cx - 30 + glint * 64;
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(gx - 6, -168 + 24);
    c.lineTo(gx + 12, -168 - 24);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(gx + 6, -168 + 24);
    c.lineTo(gx + 20, -168 - 24);
    c.stroke();
    c.restore();
  }
  c.strokeStyle = P.glasses;
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(-6, -171);
  c.quadraticCurveTo(0, -178, 6, -171);
  c.moveTo(-57, -172);
  c.lineTo(-79, -174);
  c.moveTo(57, -172);
  c.lineTo(79, -174);
  c.stroke();
}

function head(c, P, st) {
  const skinD = shade(P.skin, -0.14);
  const skinL = shade(P.skin, 0.14);
  for (const s of [-1, 1]) {
    ell(c, s * 79, -166, 12.5, 19, P.skin);
    ell(c, s * 80, -166, 6.5, 11, skinD);
  }
  c.beginPath();
  c.moveTo(-79, -170);
  c.bezierCurveTo(-79, -252, -42, -266, 0, -266);
  c.bezierCurveTo(42, -266, 79, -252, 79, -170);
  c.bezierCurveTo(79, -108, 44, -76, 0, -76);
  c.bezierCurveTo(-44, -76, -79, -108, -79, -170);
  c.closePath();
  c.fillStyle = lin(c, -70, -250, 74, -90, [[0, skinL], [0.5, P.skin], [1, shade(P.skin, -0.1)]]);
  c.fill();
  c.save();
  c.clip();
  ell(c, 0, -246, 96, 30, 'rgba(0,0,0,0.09)'); // the shadow of the hair on the forehead
  ell(c, 0, -58, 70, 24, 'rgba(0,0,0,0.04)'); // under the jaw
  c.restore();
  for (const s of [-1, 1]) {
    const g = c.createRadialGradient(s * 47, -134, 1, s * 47, -134, 22);
    g.addColorStop(0, 'rgba(232,100,92,0.26)');
    g.addColorStop(1, 'rgba(232,100,92,0)');
    ell(c, s * 47, -134, 22, 14, g);
  }
  blit(c, layer(P, 'beard', beardPaint));
  if (P.stubble) blit(c, layer(P, 'stubble', stubblePaint));
  nose(c, P);
  eye(c, P, -1, st.blink, st.look);
  eye(c, P, 1, st.blink, st.look);
  mouth(c, P, st.mouth, st.mood);
  glasses(c, P, st.glint);
  brows(c, P, st.mood, st.brow, st.browTilt);
  blit(c, layer(P, 'hairFront', hairFrontPaint));
}

/**
 * Draws one person. The caller has moved and scaled the context so that (0, 0) is the base of the neck.
 * st: mouth 0..1, mood -1..1, blink 0..1, look {x,y} -1..1, tilt (rad), bob (px), gesture 0..1 (right arm), gesture2 (left arm),
 *     wob (hand wave, px), brow 0..1, browTilt -1..1, sway (px), shrug 0..1, lean (rad), glint 0..1
 */
export function drawPerson(c, P, st) {
  const s = { mouth: 0, mood: 0.2, blink: 0, look: { x: 0, y: 0 }, tilt: 0, bob: 0, gesture: 0, gesture2: 0, wob: 0, brow: 0, browTilt: 0, sway: 0, shrug: 0, lean: 0, glint: 0.5, ...st };
  c.save();
  c.translate(0, s.bob);
  blit(c, layer(P, 'hairBack', hairBackPaint));
  c.save();
  c.translate(s.sway, -68 - s.shrug * 7);
  c.rotate(s.lean);
  outfit(c, P);
  if (P.gestures) arms(c, P, s.gesture, s.wob, s.gesture2);
  c.restore();
  c.save();
  c.translate(s.sway * 0.6, 8);
  c.rotate(s.tilt);
  c.translate(0, -8);
  head(c, P, s);
  c.restore();
  c.restore();
}

/* ---------- the cast ---------- */

export const CAST = {
  antoni: {
    name: 'Antoni',
    role: 'the builder',
    skin: '#efc4a0',
    hair: '#5b3a23',
    style: 'curly',
    seed: 11,
    eye: '#3f8fe8',
    glasses: '#262a35',
    cloth: '#2d6ce0',
    outfit: 'hoodie',
    gestures: true,
    stubble: 0.07,
    thickBrows: true,
    lip: '#bd5d55',
  },
  elena: {
    name: 'Elena',
    role: 'seed-stage investor',
    skin: '#e8b996',
    hair: '#7a5233',
    style: 'wavy',
    eye: '#5f8f78',
    lashes: true,
    cloth: '#1d2a44',
    inner: '#15161b',
    outfit: 'blazer',
    lip: '#b4524f',
  },
  weber: {
    name: 'Prof. Weber',
    role: 'thesis examiner',
    skin: '#e9c1a0',
    hair: '#b9bcc2',
    style: 'sides',
    beard: { color: '#c4c7cc' },
    eye: '#5b7088',
    glasses: '#7b5a2e',
    roundGlasses: true,
    thickBrows: true,
    browColor: '#a5a8ae',
    cloth: '#6c6a3d',
    outfit: 'tweed',
    tie: '#8c2f3a',
    lip: '#b0645c',
  },
  marta: {
    name: 'Marta',
    role: 'your manager',
    skin: '#a9714f',
    hair: '#1d1717',
    style: 'bun',
    eye: '#3a2a22',
    lashes: true,
    cloth: '#8a2f52',
    outfit: 'blouse',
    lip: '#7b2a35',
  },
  tom: {
    name: 'Tom',
    role: 'business owner',
    skin: '#e3b592',
    hair: '#7c7e80',
    style: 'short',
    beard: { color: '#6f7173', alpha: 0.28 },
    thickBrows: true,
    eye: '#7a6a4a',
    cloth: '#566b45',
    outfit: 'shirt',
    lip: '#b4605a',
  },
};
