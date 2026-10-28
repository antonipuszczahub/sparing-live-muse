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
  onError: (err: string) => void = () => {};
  paused = false;

  start() {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      this.onError('Speech recognition is not supported in this browser. Use Edge or Chrome.');
      return;
    }
    this.running = true;
    const rec = new Ctor();
    rec.lang = 'en-US';
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
        this.onError('Microphone permission denied.');
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
