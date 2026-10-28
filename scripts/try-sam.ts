// Finds the face in a saved portrait with SAM 3.1. Run: npx tsx --env-file=.env scripts/try-sam.ts data/portraits/neutral.webp
import { readFileSync } from 'node:fs';
import { findFaces } from '../server/agents/sam.ts';

const file = process.argv[2] ?? 'data/portraits/neutral.webp';
const ext = file.endsWith('.webp') ? 'webp' : file.endsWith('.png') ? 'png' : 'jpeg';
const image = `data:image/${ext};base64,${readFileSync(file).toString('base64')}`;
const t0 = Date.now();
console.log(await findFaces(image, 'try-sam'), `${Date.now() - t0} ms`);
