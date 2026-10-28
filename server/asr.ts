import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { isLang, LANG_META } from '../shared/lang.ts';
import { ledger } from './meta/ledger.ts';
import { FLAT_PRICES, MODELS } from './meta/models.ts';

const UPSTREAM = process.env.META_ASR_URL || 'wss://api.meta.ai/v1/asr/realtime';
const MAX_SESSION_MS = 20 * 60 * 1000;

/**
 * Relays microphone audio from the browser to Muse Voice Transcribe, so the API key never
 * leaves the server. Browser -> server: raw 16-bit mono PCM at 24 kHz, 80 ms frames.
 * Server -> browser: the model's JSON events (speechStart, transcript, speechComplete...).
 * The model runs in ENDPOINTING mode and decides itself where one turn ends.
 */
export function attachAsr(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws/asr' });

  wss.on('connection', (client, req) => {
    const params = new URL(req.url ?? '', 'http://localhost').searchParams;
    const session = params.get('session') ?? 'asr';
    const langParam = params.get('lang');
    const language = LANG_META[isLang(langParam) ? langParam : 'en'].asr;
    const key = process.env.MODEL_API_KEY;
    if (!key) return void client.close(4500, 'MODEL_API_KEY is not set');
    if (!ledger.canSpend(session).ok) return void client.close(4429, 'budget');

    const started = Date.now();
    let ready = false;
    let recorded = false;
    const up = new WebSocket(UPSTREAM);

    const record = () => {
      if (recorded || !ready) return;
      recorded = true;
      const ms = Date.now() - started;
      ledger.record({ kind: 'asr', model: MODELS.transcribe, session, costUsd: (ms / 3_600_000) * FLAT_PRICES.transcribePerHour, totalMs: ms });
    };

    up.on('open', () =>
      up.send(
        JSON.stringify({
          authorization: { accessToken: `Bearer ${key}` },
          audioEncoding: 'PCM_24KHZ',
          model: MODELS.transcribe,
          mode: 'ENDPOINTING',
          languageBias: [language],
          emitAudioProgress: false,
        }),
      ),
    );

    up.on('message', (data, isBinary) => {
      if (isBinary) return;
      const msg = JSON.parse(data.toString()) as { type?: string; sessionId?: string };
      if (msg.sessionId && !msg.type) {
        ready = true;
        client.send(JSON.stringify({ type: 'ready' }));
        return;
      }
      if (msg.type === 'audioProgress') return;
      if (client.readyState === WebSocket.OPEN) client.send(data.toString());
    });

    up.on('error', (e) => {
      if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'error', message: e.message }));
    });
    up.on('close', () => {
      record();
      if (client.readyState === WebSocket.OPEN) client.close(1000, 'upstream closed');
    });

    client.on('message', (data, isBinary) => {
      if (isBinary && ready && up.readyState === WebSocket.OPEN) up.send(data as Buffer);
    });
    client.on('close', () => {
      record();
      if (up.readyState === WebSocket.OPEN) {
        up.send(JSON.stringify({ type: 'endStream' }));
        setTimeout(() => up.close(), 300);
      } else up.terminate();
    });

    setTimeout(() => client.close(4408, 'max duration'), MAX_SESSION_MS).unref();
  });
}
