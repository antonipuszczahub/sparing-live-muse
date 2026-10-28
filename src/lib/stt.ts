import { LANG_META } from '../../shared/lang.ts';
import type { Lang } from '../../shared/types.ts';
import { t } from '../i18n/index.ts';

interface SRResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SREvent {
  resultIndex: number;
  results: ArrayLike<SRResult>;
}
interface SR {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SR;
    SpeechRecognition?: new () => SR;
  }
}

export const sttSupported = () => !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);

/**
 * Continuous speech recognition with auto-restart. `onInterim` fires on every partial result
 * (used for barge-in), `onFinal` when the browser decides an utterance is complete.
 */
export class Ears {
  private rec: SR | null = null;
  private running = false;
  onInterim: (text: string) => void = () => {};
  onFinal: (text: string, at: number) => void = () => {};
  onError: (err: string, fatal: boolean) => void = () => {};
  paused = false;

  constructor(private lang: Lang = 'en') {}

  start() {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      this.onError(t('sttUnsupported'), true);
      return;
    }
    this.running = true;
    const rec = new Ctor();
    rec.lang = LANG_META[this.lang].speech;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        const text = r[0]!.transcript.trim();
        if (!text || this.paused) continue;
        if (r.isFinal) this.onFinal(text, Date.now());
        else this.onInterim(text);
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.running = false;
        this.onError(t('micDenied'), true);
      }
    };
    rec.onend = () => {
      if (this.running) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    this.rec = rec;
    rec.start();
  }

  stop() {
    this.running = false;
    this.rec?.abort();
    this.rec = null;
  }
}
