import { FramingTracker, type FaceBox, type FramingEvent } from '../../shared/framing.ts';

/**
 * Optional camera: every few seconds one small frame goes to SAM 3.1 (via our server) to find the face.
 * Only framing facts come out of it; no frame is stored.
 */
export class CameraWatch {
  stream: MediaStream | null = null;
  onEvents: (events: FramingEvent[]) => void = () => {};
  onFace: (box: FaceBox | null) => void = () => {};

  private video = document.createElement('video');
  private canvas = document.createElement('canvas');
  private tracker = new FramingTracker();
  private timer: number | undefined;
  private busy = false;

  constructor(private session: string, private clock: () => number) {}

  static supported() {
    return typeof navigator.mediaDevices?.getUserMedia === 'function';
  }

  async start(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
    } catch {
      return false;
    }
    this.video.srcObject = this.stream;
    this.video.muted = true;
    await this.video.play().catch(() => undefined);
    this.timer = window.setInterval(() => void this.tick(), 4000);
    window.setTimeout(() => void this.tick(), 1200);
    return true;
  }

  stop() {
    window.clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.onFace(null);
  }

  private async tick() {
    if (!this.stream || this.busy || !this.video.videoWidth) return;
    this.busy = true;
    try {
      this.canvas.width = 480;
      this.canvas.height = Math.round((480 * this.video.videoHeight) / this.video.videoWidth);
      this.canvas.getContext('2d')!.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      const image = this.canvas.toDataURL('image/jpeg', 0.6);
      const r = await fetch('/api/camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: this.session, image }),
      });
      if (!r.ok || !this.stream) return;
      const { faces } = (await r.json()) as { faces: FaceBox[] };
      const biggest = [...faces].sort((a, b) => (b.x2 - b.x1) * (b.y2 - b.y1) - (a.x2 - a.x1) * (a.y2 - a.y1))[0] ?? null;
      this.onFace(biggest);
      const events = this.tracker.push(this.clock(), faces);
      if (events.length) this.onEvents(events);
    } catch {
      /* a missed sample is fine */
    } finally {
      this.busy = false;
    }
  }
}
