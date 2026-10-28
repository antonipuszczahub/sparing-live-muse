// Checks the ElevenLabs voice: lists the voices, speaks a sample line in each default voice and saves it as WAV.
// Run: npm run check:voice            (needs ELEVENLABS_API_KEY in .env; costs about 1 cent)
//      npm run check:voice -- --voice <id>[,<id>...] --lang pl   speak the sample with specific voices
//      npm run check:voice -- --gender f --lang pl      speak it with every voice of that gender in the account
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Lang } from '../shared/types.ts';
import { defaultVoices, listVoices, speak, ttsConfig, ttsCostUsd } from '../server/tts/elevenlabs.ts';

const cfg = ttsConfig();
if (!cfg) {
  console.log('ELEVENLABS_API_KEY is not set. Create a key at https://elevenlabs.io/app/settings/api-keys and put it in .env.');
  process.exit(1);
}

const argv = process.argv.slice(2);
const arg = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const SAMPLE: Record<Lang, string> = {
  pl: 'Dzień dobry, Grzegorz Malinowski, słucham. Skąd Pani wzięła te siedem sekund? Mierzyła to Pani u nas, czy to tylko wasze narzędzie tak pokazuje?',
  en: 'Hello, Greg Holloway speaking. Where did you get that seven seconds from? Did you measure it on our site, or is that just what your tool says?',
};

function wav(pcm: Buffer): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(24000, 24);
  h.writeUInt32LE(48000, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

mkdirSync('data/voice-samples', { recursive: true });
let chars = 0;

async function say(lang: Lang, id: string, label: string) {
  const t0 = Date.now();
  const res = await speak(cfg!, { voiceId: id, text: SAMPLE[lang], lang });
  const reader = res.body!.getReader();
  const parts: Buffer[] = [];
  let first = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    first ||= Date.now() - t0;
    parts.push(Buffer.from(value));
  }
  const pcm = Buffer.concat(parts);
  const file = `data/voice-samples/${lang}-${label}.wav`;
  writeFileSync(file, wav(pcm));
  chars += SAMPLE[lang].length;
  console.log(`  ${file}: ${(pcm.length / 48000).toFixed(1)} s of speech, first audio after ${first} ms, whole sentence after ${Date.now() - t0} ms`);
}

console.log(`Model ${cfg.model}\n`);
const ids = arg('--voice')?.split(',').filter(Boolean);
const gender = arg('--gender');
const langs: Lang[] = arg('--lang') ? [arg('--lang') as Lang] : ['pl', 'en'];
for (const lang of langs) {
  const voices = await listVoices(cfg, lang);
  console.log(`${lang}: ${voices.length} voices in the account`);
  for (const v of voices.slice(0, 12)) console.log(`  ${v.native ? '*' : ' '} ${v.name.padEnd(18)} ${String(v.gender ?? '?').padEnd(2)} ${(v.accent ?? '').padEnd(12)} ${v.id}`);
  if (voices.length > 12) console.log(`  ... and ${voices.length - 12} more (* = made for ${lang})`);
  if (ids || gender) {
    const picked = ids ? ids.map((id) => voices.find((v) => v.id === id) ?? { id, name: id.slice(0, 8), gender: null }) : voices.filter((v) => v.gender === gender && !v.locked);
    for (const v of picked) await say(lang, v.id, `${v.gender ?? 'x'}-${v.name.split(' ')[0]!.replace(/[^\p{L}]/gu, '')}`);
    continue;
  }
  const d = defaultVoices(voices, lang);
  for (const g of ['f', 'm'] as const) {
    const id = d[g];
    if (id) await say(lang, id, `${g}-${voices.find((v) => v.id === id)?.name ?? id}`);
    else console.log(`  no ${g === 'f' ? 'female' : 'male'} voice found`);
  }
}
console.log(`\nSpoke ${chars} characters, about $${ttsCostUsd(chars, cfg.usdPer1k).toFixed(3)} at $${cfg.usdPer1k} per 1,000.`);
