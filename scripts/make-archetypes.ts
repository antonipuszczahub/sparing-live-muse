// Draws one portrait per scenario for the start screen and saves it to public/archetypes. Run: npm run make:archetypes
// Four images, about 4 cents. The files are committed, so the start screen needs no model call.
import { mkdirSync, writeFileSync } from 'node:fs';
import { drawArchetype } from '../server/agents/portrait.ts';
import type { ScenarioId } from '../shared/types.ts';

const WHO: Record<ScenarioId, 'm' | 'f'> = { sales: 'm', defense: 'f', salary: 'm', pitch: 'f' };
const out = 'public/archetypes';
mkdirSync(out, { recursive: true });
await Promise.all(
  (Object.keys(WHO) as ScenarioId[]).map(async (id) => {
    const t0 = Date.now();
    const url = await drawArchetype(id, WHO[id], 'make-archetypes');
    const [, ext, b64] = /^data:image\/(\w+);base64,(.+)$/.exec(url)!;
    writeFileSync(`${out}/${id}.${ext}`, Buffer.from(b64!, 'base64'));
    console.log(`${id}.${ext}  ${Math.round((b64!.length * 0.75) / 1024)} KB  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }),
);
