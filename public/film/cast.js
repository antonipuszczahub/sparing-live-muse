// Flat-vector people for the film: one parametric renderer, many looks. Origin = the base of the neck, +y is down.
// Everything is canvas paths, no images and no libraries.

const TAU = Math.PI * 2;

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

/* ---------- hair ---------- */

function curls(seed) {
  const r = rng(seed);
  const back = [];
  // a halo of curls around the head, loose and uneven
  for (let i = 0; i < 30; i++) {
    const a = Math.PI * (1.02 + (i / 29) * 0.96);
    const rad = 1 + (r() - 0.5) * 0.12;
    back.push({ x: Math.cos(a) * 96 * rad, y: -178 + Math.sin(a) * 104 * rad, r: 26 + r() * 12, tone: r() });
  }
  // curls that hang down past the ears
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++) back.push({ x: s * (82 + r() * 20), y: -178 + i * 15 + r() * 8, r: 20 + r() * 9, tone: r() });
  }
  const front = [];
  for (let i = 0; i < 11; i++) {
    const x = -66 + (i / 10) * 132 + (r() - 0.5) * 8;
    front.push({ x, y: -240 + Math.abs(x) * 0.22 + (r() - 0.5) * 8, r: 20 + r() * 8, tone: r() });
  }
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) front.push({ x: s * (68 + i * 4), y: -214 + i * 16, r: 14 + r() * 5, tone: r() });
  return { back, front };
}

function drawCurls(c, list, base) {
  const dark = shade(base, -0.16);
  const light = shade(base, 0.12);
  for (const k of list) {
    ell(c, k.x, k.y, k.r, k.r * 0.96, k.tone < 0.34 ? dark : k.tone < 0.78 ? base : light);
  }
}

function hairBack(c, P) {
  const h = P.hair;
  if (P.style === 'curly') {
    ell(c, 0, -186, 94, 100, h);
    drawCurls(c, P._curls.back, h);
  } else if (P.style === 'wavy') {
    c.beginPath();
    c.moveTo(-86, -196);
    c.bezierCurveTo(-118, -270, 118, -270, 86, -196);
    c.bezierCurveTo(112, -150, 96, -70, 112, 6);
    c.bezierCurveTo(70, 26, 40, -20, 0, -20);
    c.bezierCurveTo(-40, -20, -70, 26, -112, 6);
    c.bezierCurveTo(-96, -70, -112, -150, -86, -196);
    c.closePath();
    c.fillStyle = shade(h, -0.1);
    c.fill();
  } else if (P.style === 'bun') {
    ell(c, 0, -286, 30, 28, shade(h, -0.05));
  }
}

function hairFront(c, P) {
  const h = P.hair;
  if (P.style === 'curly') {
    drawCurls(c, P._curls.front, h);
  } else if (P.style === 'wavy') {
    c.beginPath();
    c.moveTo(-80, -166);
    c.bezierCurveTo(-88, -252, -24, -280, 22, -270);
    c.bezierCurveTo(72, -262, 88, -222, 80, -166);
    c.bezierCurveTo(74, -206, 44, -230, 2, -226);
    c.bezierCurveTo(-36, -222, -66, -204, -80, -166);
    c.closePath();
    c.fillStyle = h;
    c.fill();
    c.strokeStyle = shade(h, 0.2);
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-50, -240);
    c.quadraticCurveTo(-10, -262, 36, -252);
    c.stroke();
  } else if (P.style === 'short' || P.style === 'bun') {
    c.beginPath();
    c.moveTo(-79, -166);
    c.bezierCurveTo(-84, -252, -40, -272, 0, -272);
    c.bezierCurveTo(40, -272, 84, -252, 79, -166);
    c.bezierCurveTo(72, -200, 54, -222, 0, -224);
    c.bezierCurveTo(-54, -222, -72, -200, -79, -166);
    c.closePath();
    c.fillStyle = h;
    c.fill();
    c.strokeStyle = shade(h, 0.18);
    c.lineWidth = 3.5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-40, -250);
    c.quadraticCurveTo(0, -262, 38, -248);
    c.stroke();
  } else if (P.style === 'sides') {
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 70, -232);
      c.bezierCurveTo(s * 94, -222, s * 94, -170, s * 78, -150);
      c.lineTo(s * 72, -190);
      c.closePath();
      c.fillStyle = h;
      c.fill();
    }
    c.beginPath();
    c.moveTo(-66, -236);
    c.bezierCurveTo(-30, -266, 30, -266, 66, -236);
    c.bezierCurveTo(30, -246, -30, -246, -66, -236);
    c.fillStyle = h;
    c.fill();
  }
}

function beard(c, P) {
  if (!P.beard) return;
  const col = P.beard.color;
  c.beginPath();
  c.moveTo(-76, -166);
  c.bezierCurveTo(-78, -120, -50, -86, 0, -80);
  c.bezierCurveTo(50, -86, 78, -120, 76, -166);
  c.bezierCurveTo(70, -140, 56, -134, 42, -132);
  c.quadraticCurveTo(0, -148, -42, -132);
  c.bezierCurveTo(-56, -134, -70, -140, -76, -166);
  c.closePath();
  c.globalAlpha = P.beard.alpha ?? 1;
  c.fillStyle = col;
  c.fill();
  c.globalAlpha = 1;
  if ((P.beard.alpha ?? 1) > 0.6) {
    c.beginPath();
    c.moveTo(-36, -139);
    c.quadraticCurveTo(0, -153, 36, -139);
    c.quadraticCurveTo(20, -126, 0, -131);
    c.quadraticCurveTo(-20, -126, -36, -139);
    c.fillStyle = shade(col, -0.05);
    c.fill();
  }
}

/* ---------- body ---------- */

function torsoPath(c) {
  c.beginPath();
  c.moveTo(-158, 420);
  c.lineTo(-156, 112);
  c.bezierCurveTo(-154, 56, -112, 22, -52, 14);
  c.lineTo(52, 14);
  c.bezierCurveTo(112, 22, 154, 56, 156, 112);
  c.lineTo(158, 420);
  c.closePath();
}

function neck(c, P) {
  const skinD = shade(P.skin, -0.14);
  rrect(c, -25, -92, 50, 124, 18);
  c.fillStyle = P.skin;
  c.fill();
  // the shadow of the chin
  c.save();
  rrect(c, -25, -92, 50, 124, 18);
  c.clip();
  ell(c, 0, -76, 52, 30, skinD);
  c.restore();
}

function outfit(c, P) {
  const cl = P.cloth;
  const dark = shade(cl, -0.2);
  const light = shade(cl, 0.18);
  if (P.outfit === 'hoodie') {
    ell(c, 0, 8, 104, 50, dark); // the hood, resting behind the neck
    torsoPath(c);
    c.fillStyle = cl;
    c.fill();
    neck(c, P);
    // the hood's opening, hugging the neck
    c.lineCap = 'round';
    c.strokeStyle = dark;
    c.lineWidth = 30;
    c.beginPath();
    c.arc(0, -4, 56, 0.12 * Math.PI, 0.88 * Math.PI);
    c.stroke();
    c.strokeStyle = light;
    c.lineWidth = 4;
    c.beginPath();
    c.arc(0, -4, 44, 0.16 * Math.PI, 0.84 * Math.PI);
    c.stroke();
    // drawstrings
    c.strokeStyle = '#f4f4f6';
    c.lineWidth = 4;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 20, 56);
      c.quadraticCurveTo(s * 26, 90, s * 22, 128);
      c.stroke();
      ell(c, s * 22, 132, 4.5, 7, '#f4f4f6');
    }
    // the folds of the sleeves
    c.strokeStyle = shade(cl, -0.12);
    c.lineWidth = 3;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 120, 70);
      c.quadraticCurveTo(s * 100, 130, s * 112, 210);
      c.stroke();
    }
  } else if (P.outfit === 'blazer') {
    torsoPath(c);
    c.fillStyle = cl;
    c.fill();
    neck(c, P);
    poly(c, [[-44, 12], [44, 12], [0, 150]], P.inner);
    poly(c, [[-44, 12], [-112, 52], [-34, 186], [-8, 130]], light);
    poly(c, [[44, 12], [112, 52], [34, 186], [8, 130]], light);
    c.strokeStyle = dark;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-44, 12);
    c.lineTo(-8, 130);
    c.moveTo(44, 12);
    c.lineTo(8, 130);
    c.stroke();
  } else if (P.outfit === 'tweed') {
    torsoPath(c);
    c.fillStyle = cl;
    c.fill();
    c.globalAlpha = 0.16;
    c.fillStyle = '#000';
    for (let y = 40; y < 330; y += 14) for (let x = -150 + ((y / 14) % 2) * 7; x < 156; x += 14) c.fillRect(x, y, 3, 3);
    c.globalAlpha = 1;
    neck(c, P);
    poly(c, [[-42, 12], [42, 12], [0, 140]], '#f1efe9');
    poly(c, [[-42, 12], [-12, 44], [-46, 54]], '#ffffff');
    poly(c, [[42, 12], [12, 44], [46, 54]], '#ffffff');
    poly(c, [[-12, 30], [12, 30], [6, 54], [0, 60], [-6, 54]], P.tie);
    poly(c, [[-7, 58], [7, 58], [14, 170], [0, 182], [-14, 170]], P.tie);
    poly(c, [[-44, 12], [-112, 52], [-36, 190], [-10, 140]], dark);
    poly(c, [[44, 12], [112, 52], [36, 190], [10, 140]], dark);
  } else if (P.outfit === 'blouse') {
    torsoPath(c);
    c.fillStyle = cl;
    c.fill();
    neck(c, P);
    poly(c, [[-46, 12], [46, 12], [0, 96]], P.skin);
    poly(c, [[-46, 12], [-8, 100], [-70, 60]], light);
    poly(c, [[46, 12], [8, 100], [70, 60]], light);
    c.strokeStyle = dark;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-46, 12);
    c.lineTo(-8, 100);
    c.moveTo(46, 12);
    c.lineTo(8, 100);
    c.stroke();
    ell(c, 0, 108, 6, 6, '#e8c872');
    c.strokeStyle = '#e8c872';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 30, 44, 0.2 * Math.PI, 0.8 * Math.PI);
    c.stroke();
  } else {
    // shirt
    torsoPath(c);
    c.fillStyle = cl;
    c.fill();
    neck(c, P);
    poly(c, [[-44, 12], [0, 40], [-26, 74], [-62, 30]], light);
    poly(c, [[44, 12], [0, 40], [26, 74], [62, 30]], light);
    c.strokeStyle = dark;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 40);
    c.lineTo(0, 420);
    c.stroke();
    for (let y = 90; y < 300; y += 62) ell(c, 8, y, 4.5, 4.5, dark);
  }
}

function arm(c, P, g) {
  // the arm on the viewer's right, raised to gesture
  const sx = 118;
  const sy = 56;
  const hx = 124 + g * 40;
  const hy = 206 - g * 200;
  const ex = 146 + g * 22;
  const ey = 168 - g * 70;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = P.cloth;
  c.lineWidth = 52;
  c.beginPath();
  c.moveTo(sx, sy);
  c.lineTo(ex, ey);
  c.lineTo(hx, hy + 26);
  c.stroke();
  c.strokeStyle = shade(P.cloth, -0.14);
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(ex - 6, ey + 6);
  c.lineTo(hx - 10, hy + 40);
  c.stroke();
  // hand
  const skinD = shade(P.skin, -0.12);
  ell(c, hx, hy, 24, 27, P.skin);
  for (let i = 0; i < 4; i++) {
    const a = -1.9 + i * 0.42;
    ell(c, hx + Math.cos(a) * 22, hy + Math.sin(a) * 25, 8.5, 12, P.skin, a + Math.PI / 2);
  }
  ell(c, hx - 24, hy + 6, 8, 14, P.skin, -0.7);
  c.strokeStyle = skinD;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(hx, hy + 4, 14, 0.4, 2.4);
  c.stroke();
}

/* ---------- face ---------- */

function eye(c, P, s, blink, look) {
  const x = s * 31 + look.x * 3;
  const y = -168 + look.y * 2;
  const ry = Math.max(1.2, 12.5 * (1 - blink * 0.95));
  c.save();
  c.beginPath();
  c.ellipse(s * 31, -168, 14.5, ry, 0, 0, TAU);
  c.fillStyle = '#ffffff';
  c.fill();
  c.clip();
  ell(c, x + look.x * 3, y, 8.4, 8.4, P.eye);
  ell(c, x + look.x * 3, y, 4.2, 4.2, '#10131c');
  ell(c, x + look.x * 3 - 2.6, y - 2.8, 2.1, 2.1, '#ffffff');
  c.restore();
  // lid line
  c.strokeStyle = shade(P.skin, -0.55);
  c.lineWidth = 3.2;
  c.lineCap = 'round';
  c.beginPath();
  c.ellipse(s * 31, -168, 14.5, ry, 0, Math.PI * 1.04, Math.PI * 1.96);
  c.stroke();
}

function brows(c, P, mood, raise) {
  const col = P.browColor ?? shade(P.hair, -0.1);
  c.strokeStyle = col;
  c.lineWidth = P.thickBrows ? 8 : 6;
  c.lineCap = 'round';
  const y = -197 - raise * 8;
  const worry = mood < -0.2 ? -mood : 0;
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(s * 14, y + 4 - worry * 5 - raise * 3);
    c.quadraticCurveTo(s * 32, y - 6 - raise * 3, s * 50, y + 3 + worry * 3);
    c.stroke();
  }
}

function mouth(c, P, open, mood) {
  const y = -116;
  const w = 25 + open * 4 + Math.max(0, mood) * 4;
  const smile = mood * 10;
  const lip = P.lip ?? '#c4605b';
  if (open < 0.07) {
    c.strokeStyle = lip;
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-w, y - smile * 0.15);
    c.quadraticCurveTo(0, y + 2 + smile, w, y - smile * 0.15);
    c.stroke();
    return;
  }
  const dn = 6 + open * 30;
  c.beginPath();
  c.moveTo(-w, y);
  c.quadraticCurveTo(0, y - 3 + smile * 0.2, w, y);
  c.quadraticCurveTo(w * 0.7, y + dn * 1.15, 0, y + dn * 1.2);
  c.quadraticCurveTo(-w * 0.7, y + dn * 1.15, -w, y);
  c.closePath();
  c.fillStyle = '#3a1618';
  c.fill();
  c.save();
  c.clip();
  if (open > 0.22) {
    c.fillStyle = '#fbfaf8';
    c.fillRect(-w, y - 3, w * 2, 8 + open * 4);
  }
  ell(c, 0, y + dn * 1.15, w * 0.55, dn * 0.5, '#d5736f');
  c.restore();
  c.strokeStyle = lip;
  c.lineWidth = 4;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-w, y);
  c.quadraticCurveTo(0, y - 3 + smile * 0.2, w, y);
  c.stroke();
}

function glasses(c, P) {
  if (!P.glasses) return;
  c.strokeStyle = P.glasses;
  c.lineWidth = 4.5;
  c.lineJoin = 'round';
  for (const s of [-1, 1]) {
    rrect(c, s * 31 - 25, -168 - 20, 50, 40, P.roundGlasses ? 20 : 12);
    c.fillStyle = 'rgba(255,255,255,0.07)';
    c.fill();
    c.stroke();
    c.save();
    rrect(c, s * 31 - 25, -168 - 20, 50, 40, P.roundGlasses ? 20 : 12);
    c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.28)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(s * 31 - 12, -168 + 18);
    c.lineTo(s * 31 + 6, -168 - 18);
    c.stroke();
    c.restore();
    c.strokeStyle = P.glasses;
    c.lineWidth = 4.5;
  }
  c.beginPath();
  c.moveTo(-7, -170);
  c.quadraticCurveTo(0, -176, 7, -170);
  c.moveTo(-56, -170);
  c.lineTo(-78, -172);
  c.moveTo(56, -170);
  c.lineTo(78, -172);
  c.stroke();
}

function head(c, P, st) {
  const skinD = shade(P.skin, -0.12);
  // ears
  for (const s of [-1, 1]) {
    ell(c, s * 77, -166, 12, 18, P.skin);
    ell(c, s * 78, -166, 6, 10, skinD);
  }
  // the head
  c.beginPath();
  c.moveTo(-76, -170);
  c.bezierCurveTo(-76, -250, -40, -264, 0, -264);
  c.bezierCurveTo(40, -264, 76, -250, 76, -170);
  c.bezierCurveTo(76, -110, 42, -78, 0, -78);
  c.bezierCurveTo(-42, -78, -76, -110, -76, -170);
  c.closePath();
  c.fillStyle = P.skin;
  c.fill();
  // soft shade on one side and blush
  c.save();
  c.clip();
  ell(c, -80, -160, 34, 110, 'rgba(0,0,0,0.05)');
  c.restore();
  for (const s of [-1, 1]) ell(c, s * 46, -134, 15, 9, 'rgba(232,110,100,0.16)');
  beard(c, P);
  // nose
  c.strokeStyle = shade(P.skin, -0.2);
  c.lineWidth = 3.2;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-3, -158);
  c.quadraticCurveTo(7, -142, 1, -137);
  c.stroke();
  eye(c, P, -1, st.blink, st.look);
  eye(c, P, 1, st.blink, st.look);
  mouth(c, P, st.mouth, st.mood);
  glasses(c, P);
  brows(c, P, st.mood, st.brow);
  hairFront(c, P);
}

/**
 * Draws one person. The caller has already moved and scaled the context so that (0, 0) is the base of the neck.
 * st: mouth 0..1, mood -1..1, blink 0..1, look {x,y} -1..1, tilt (radians), bob (px), gesture 0..1, brow 0..1
 */
export function drawPerson(c, P, st) {
  if (P.style === 'curly' && !P._curls) P._curls = curls(P.seed ?? 7);
  const s = { mouth: 0, mood: 0.2, blink: 0, look: { x: 0, y: 0 }, tilt: 0, bob: 0, gesture: 0, brow: 0, ...st };
  c.save();
  c.translate(0, s.bob);
  hairBack(c, P);
  c.save();
  c.translate(0, -68);
  outfit(c, P);
  if (P.gestures && s.gesture > 0.02) arm(c, P, s.gesture);
  c.restore();
  c.save();
  c.translate(0, 8);
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
    skin: '#f0c7a4',
    hair: '#5b3a23',
    style: 'curly',
    seed: 11,
    eye: '#3f8fe8',
    glasses: '#2b2f3a',
    cloth: '#2f6fe3',
    outfit: 'hoodie',
    gestures: true,
    lip: '#bf5f58',
    pitch: 0.8,
  },
  elena: {
    name: 'Elena',
    role: 'seed-stage investor',
    skin: '#e8b996',
    hair: '#7a5233',
    style: 'wavy',
    eye: '#6a8f7a',
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
