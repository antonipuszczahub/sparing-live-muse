// Streams a 24 kHz mono WAV to Muse Voice Transcribe in ENDPOINTING mode and prints every event.
// Run: npx tsx --env-file=.env scripts/try-asr.ts path/to/hello.wav
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('Pass a 24 kHz mono 16-bit WAV file');
const pcm = readFileSync(file).subarray(44); // skip the RIFF header
const FRAME = 3840; // 80 ms at 24 kHz, 16-bit mono

// ASR_URL=ws://localhost:8787/ws/asr?session=try tests our relay instead of Meta directly.
const viaRelay = Boolean(process.env.ASR_URL);
const ws = new WebSocket(process.env.ASR_URL ?? 'wss://api.meta.ai/v1/asr/realtime');
ws.binaryType = 'arraybuffer';
const t0 = Date.now();
const log = (...a: unknown[]) => console.log(String(Date.now() - t0).padStart(6), ...a);
let sentAll = 0;

ws.onopen = () => {
  log('open');
  if (!viaRelay)
    ws.send(
    JSON.stringify({
      authorization: { accessToken: `Bearer ${process.env.MODEL_API_KEY}` },
      audioEncoding: 'PCM_24KHZ',
      model: 'muse-voice-transcribe-1.0',
      mode: 'ENDPOINTING',
      languageBias: ['English'],
    }),
  );
};

let ready = false;
ws.onmessage = async (e) => {
  if (typeof e.data !== 'string') return;
  const msg = JSON.parse(e.data);
  if ((msg.sessionId && !msg.type) || msg.type === 'ready') {
    ready = true;
    log('handshake ok', msg.sessionId);
    for (let off = 0; off < pcm.length; off += FRAME) {
      ws.send(pcm.subarray(off, off + FRAME));
      await new Promise((r) => setTimeout(r, 80)); // real-time pacing
    }
    sentAll = Date.now() - t0;
    log('audio sent, adding 1.5 s of silence for endpointing');
    for (let i = 0; i < 19; i++) {
      ws.send(new Uint8Array(FRAME));
      await new Promise((r) => setTimeout(r, 80));
    }
    return;
  }
  if (msg.type === 'audioProgress') return;
  log(msg.type, JSON.stringify(msg).slice(0, 200));
  if (msg.type === 'speechComplete') {
    log(`end-of-speech to final text: ~${Date.now() - t0 - sentAll} ms after the audio ended`);
    ws.send(JSON.stringify({ type: 'endStream' }));
    setTimeout(() => ws.close(), 500);
  }
};
ws.onerror = (e) => log('error', (e as ErrorEvent).message);
ws.onclose = (e) => {
  log('closed', e.code, e.reason, ready ? '' : '(never ready)');
  process.exit(0);
};
setTimeout(() => process.exit(1), 40000);
