/**
 * Microphone input through Muse Voice Transcribe (via our server relay).
 * Audio is captured with the browser's echo cancellation, resampled to 24 kHz 16-bit mono
 * in an AudioWorklet, and streamed in 80 ms frames. The model reports where each turn starts
 * and ends, so there is no silence timer on our side.
 */
const WORKLET = `
class Pcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 24000;
    this.pos = 0;
    this.out = new Int16Array(1920);
    this.n = 0;
  }
  process(inputs) {
    const input = inputs[0][0];
    if (!input) return true;
    while (this.pos < input.length) {
      const i = Math.floor(this.pos);
      const f = this.pos - i;
      const a = input[i];
      const b = i + 1 < input.length ? input[i + 1] : a;
      const s = Math.max(-1, Math.min(1, a + (b - a) * f));
      this.out[this.n++] = s * 32767;
      if (this.n === 1920) {
        this.port.postMessage(this.out.buffer.slice(0));
        this.n = 0;
      }
      this.pos += this.ratio;
    }
    this.pos -= input.length;
    return true;
  }
}
registerProcessor('pcm24', Pcm);
`;

import type { Lang } from '../../shared/types.ts';
import { translate } from '../i18n/index.ts';

export interface EarsLike {
  onInterim: (text: string) => void;
  onFinal: (text: string, at: number) => void;
  /** fatal = this input path is dead; the caller may switch to another one. */
  onError: (message: string, fatal: boolean) => void;
  start(): void;
  stop(): void;
}

export class MetaEars implements EarsLike {
  onInterim: (text: string) => void = () => {};
  onFinal: (text: string, at: number) => void = () => {};
  onError: (message: string, fatal: boolean) => void = () => {};
  onSpeechStart: () => void = () => {};

  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private stopped = false;
  private ready = false;

  constructor(
    private session: string,
    private lang: Lang = 'en',
  ) {}

  private say(key: Parameters<typeof translate>[1]): string {
    return translate(this.lang, key as never);
  }

  start() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/asr?session=${encodeURIComponent(this.session)}&lang=${this.lang}`);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      const msg = JSON.parse(e.data) as { type: string; transcript?: string; message?: string };
      if (msg.type === 'ready') {
        this.ready = true;
        void this.capture();
      } else if (msg.type === 'speechStart') this.onSpeechStart();
      else if (msg.type === 'transcript' && !(msg as { final?: boolean }).final && msg.transcript) this.onInterim(msg.transcript);
      else if (msg.type === 'speechComplete' && msg.transcript?.trim()) this.onFinal(msg.transcript.trim(), Date.now());
      else if (msg.type === 'error') this.onError(msg.message ?? this.say('asrError'), !this.ready);
    };
    ws.onclose = (e) => {
      if (this.stopped) return;
      this.releaseAudio();
      this.onError(e.code === 4429 ? this.say('asrBudget') : this.say('asrDisconnected'), true);
    };
    ws.onerror = () => {
      if (!this.ready && !this.stopped) this.onError(this.say('asrUnreachable'), true);
    };
  }

  private async capture() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (this.stopped) return this.releaseAudio();
      this.ctx = new AudioContext({ sampleRate: 24000 });
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const src = this.ctx.createMediaStreamSource(this.stream);
      const node = new AudioWorkletNode(this.ctx, 'pcm24');
      node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(e.data);
      };
      src.connect(node);
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'NotFoundError');
      this.onError(denied ? this.say('micDenied') : this.say('micFailed'), !denied);
    }
  }

  private releaseAudio() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  stop() {
    this.stopped = true;
    this.releaseAudio();
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) this.ws.close();
    this.ws = null;
  }
}
