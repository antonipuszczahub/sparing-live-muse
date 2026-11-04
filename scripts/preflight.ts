// One command before recording the demo: checks the things that would ruin a take. Run: npm run preflight
// The dev server must be running (npm run dev). Nothing here calls a model, so it costs nothing, and no key is ever printed.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

type Level = 'ok' | 'warn' | 'fail';
const rows: { level: Level; text: string }[] = [];
const add = (level: Level, text: string) => rows.push({ level, text });
const git = (...args: string[]) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

const port = process.env.PORT || '8787';
const web = 'http://localhost:5173/';

// --- environment (the keys themselves are never printed) ---
const major = Number(process.versions.node.split('.')[0]);
add(major >= 22 ? 'ok' : 'fail', `Node ${process.versions.node}${major >= 22 ? '' : ' (the README asks for 22+)'}`);
add(process.env.MODEL_API_KEY ? 'ok' : 'fail', process.env.MODEL_API_KEY ? 'Meta key present in the environment' : 'MODEL_API_KEY is missing (.env)');

// --- the running app ---
try {
  const r = await fetch(`http://localhost:${port}/api/health`, { signal: AbortSignal.timeout(4000) });
  const h = (await r.json()) as {
    keyConfigured?: boolean;
    openWeights?: boolean;
    openHost?: string;
    openDefault?: boolean;
    budget?: { spentToday: number; dailyLimit: number };
  };
  add('ok', `Server answers on :${port}`);
  add(h.keyConfigured ? 'ok' : 'fail', h.keyConfigured ? 'Server sees the Meta key' : 'Server does not see the Meta key');
  add(h.openWeights && h.openDefault ? 'ok' : 'warn', h.openWeights ? `Open weights ${h.openDefault ? 'on by default' : 'available but NOT the default'} (${h.openHost ?? '?'})` : 'No open-weights host: the demo will not show Muse Spark Open');
  if (h.budget) {
    const left = h.budget.dailyLimit - h.budget.spentToday;
    add(left >= 1 ? 'ok' : 'warn', `Budget today: $${h.budget.spentToday.toFixed(2)} of $${h.budget.dailyLimit.toFixed(2)} used (a call costs a few cents)`);
  }
} catch {
  add('fail', `Server does not answer on :${port}. Start it with: npm.cmd run dev`);
}
try {
  const r = await fetch(web, { signal: AbortSignal.timeout(4000) });
  add(r.ok ? 'ok' : 'fail', r.ok ? `Interface answers on ${web}` : `Interface returned ${r.status}`);
} catch {
  add('fail', `Interface does not answer on ${web}`);
}

// --- files the demo and the judges need ---
const need = ['LICENSE', 'README.md', 'docs/DEMO.md', 'public/favicon.svg', 'public/icon-512.png', 'public/manifest.webmanifest', ...['sales', 'defense', 'salary', 'pitch'].map((id) => `public/archetypes/${id}.webp`)];
const missing = need.filter((f) => !existsSync(f));
add(missing.length ? 'fail' : 'ok', missing.length ? `Missing files: ${missing.join(', ')}` : 'Licence, README, demo script, icons and the four start-screen portraits are all there');
if (existsSync('docs/MANIFEST.md')) {
  const days = (Date.now() - statSync('docs/MANIFEST.md').mtimeMs) / 86_400_000;
  const head = readFileSync('docs/MANIFEST.md', 'utf8').match(/\*\*([\d,]+)\*\* model calls/)?.[1];
  add(days < 1.5 ? 'ok' : 'warn', `docs/MANIFEST.md is ${days.toFixed(1)} days old${head ? ` (${head} calls)` : ''}${days < 1.5 ? '' : ': run npm run manifest before submitting'}`);
}

// --- git ---
const dirty = git('status', '--porcelain')?.split('\n').filter((l) => l && !l.includes('.claude/')).length;
if (dirty !== undefined) add(dirty ? 'warn' : 'ok', dirty ? `${dirty} uncommitted change(s): commit before submitting` : 'Working tree is committed');
const ahead = git('rev-list', '--count', '@{u}..HEAD');
if (ahead !== null) add(Number(ahead) ? 'warn' : 'ok', Number(ahead) ? `${ahead} commit(s) not pushed to GitHub yet` : 'Everything is pushed');

// --- report ---
const icon: Record<Level, string> = { ok: '[ ok ]', warn: '[warn]', fail: '[FAIL]' };
console.log('\nSparing Live: demo preflight\n');
for (const r of rows) console.log(`${icon[r.level]} ${r.text}`);
console.log('\nBy hand, before pressing record:');
console.log('  - Microsoft Edge, headphones on (the character must not hear itself), microphone allowed for localhost');
console.log('  - Start screen -> "Character voice": pick a Natural voice and play the sample');
console.log('  - Company research for the demo already run once (it is cached for 24 h)');
console.log('  - Screen-share deck open in another window; docs/DEMO.md is the shot list');
const fails = rows.filter((r) => r.level === 'fail').length;
const warns = rows.filter((r) => r.level === 'warn').length;
console.log(`\n${fails ? `NOT READY: ${fails} problem(s)` : warns ? `READY, with ${warns} warning(s)` : 'READY'}\n`);
process.exit(fails ? 1 : 0);
