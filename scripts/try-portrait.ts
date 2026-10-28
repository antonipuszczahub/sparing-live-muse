// Draws the three portraits for a character and saves them. Run: npm run try:portrait
import { mkdirSync, writeFileSync } from 'node:fs';
import { drawPortraits } from '../server/agents/portrait.ts';
import { rollVariant } from '../shared/variation.ts';

const v = rollVariant('sales', 12345);
const t0 = Date.now();
const p = await drawPortraits({ persona: v.persona, scenario: 'sales', mood: v.mood, session: 'try-portrait' });
console.log(`Portraits for ${v.persona.name} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const out = process.argv[2] ?? 'data/portraits';
mkdirSync(out, { recursive: true });
for (const [name, url] of Object.entries(p)) {
  const [, ext, b64] = /^data:image\/(\w+);base64,(.+)$/.exec(url)!;
  writeFileSync(`${out}/${name}.${ext}`, Buffer.from(b64!, 'base64'));
  console.log(` ${name}.${ext}  ${Math.round((b64!.length * 0.75) / 1024)} KB`);
}
