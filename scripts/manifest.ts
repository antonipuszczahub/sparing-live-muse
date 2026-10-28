// Rebuilds docs/MANIFEST.md from the budget ledger. Run: npm run manifest
import { readFileSync, writeFileSync } from 'node:fs';
import { parseManifest, renderManifest } from '../server/meta/manifest.ts';

const from = process.env.MANIFEST_PATH || 'data/manifest.jsonl';
let text = '';
try {
  text = readFileSync(from, 'utf8');
} catch {
  console.log(`No ledger at ${from} yet; writing an empty manifest.`);
}
const entries = parseManifest(text);
writeFileSync('docs/MANIFEST.md', renderManifest(entries));
console.log(`docs/MANIFEST.md written from ${entries.length} recorded calls.`);
