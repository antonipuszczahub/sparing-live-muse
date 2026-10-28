/**
 * Shares the user's screen with the eye agent. A frame is only sent when the picture has
 * actually changed and settled (new slide, scrolled code), which keeps cost and latency low.
 */
export class ScreenShare {
  private stream: MediaStream | null = null;
  private video = document.createElement('video');
  private canvas = document.createElement('canvas');
  private timer: number | undefined;
  private lastSent: Uint8ClampedArray | null = null;
  private lastTick: Uint8ClampedArray | null = null;
  private busy = false;
  onEnded: () => void = () => {};

  constructor(
    private look: (imageDataUrl: string) => Promise<string | null>,
    private onNotes: (notes: string, first: boolean) => void,
  ) {}

  static supported() {
    return typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  }

  get active() {
    return this.stream !== null;
  }

  async start(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 2 }, audio: false });
    } catch {
      return false;
    }
    this.stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      this.stop();
      this.onEnded();
    });
    this.video.srcObject = this.stream;
    this.video.muted = true;
    await this.video.play().catch(() => undefined);
    this.lastSent = null;
    this.lastTick = null;
    this.timer = window.setInterval(() => void this.tick(), 2500);
    window.setTimeout(() => void this.tick(), 800);
    return true;
  }

  stop() {
    window.clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  /** 32x18 grayscale thumbnail used to tell whether the screen changed. */
  private signature(): Uint8ClampedArray | null {
    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    if (!w || !h) return null;
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 18;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(this.video, 0, 0, 32, 18);
    const px = ctx.getImageData(0, 0, 32, 18).data;
    const g = new Uint8ClampedArray(32 * 18);
    for (let i = 0; i < g.length; i++) g[i] = (px[i * 4]! + px[i * 4 + 1]! + px[i * 4 + 2]!) / 3;
    return g;
  }

  private static diff(a: Uint8ClampedArray, b: Uint8ClampedArray) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i]! - b[i]!);
    return s / a.length;
  }

  private jpeg(): string {
    const scale = Math.min(1, 1280 / this.video.videoWidth);
    this.canvas.width = Math.round(this.video.videoWidth * scale);
    this.canvas.height = Math.round(this.video.videoHeight * scale);
    this.canvas.getContext('2d')!.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    return this.canvas.toDataURL('image/jpeg', 0.72);
  }

  private async tick() {
    if (!this.stream || this.busy) return;
    const sig = this.signature();
    if (!sig) return;
    const settled = this.lastTick !== null && ScreenShare.diff(sig, this.lastTick) < 1.5;
    this.lastTick = sig;
    const changed = this.lastSent === null || ScreenShare.diff(sig, this.lastSent) > 4;
    if (!settled || !changed) return;
    this.busy = true;
    const first = this.lastSent === null;
    this.lastSent = sig;
    try {
      const notes = await this.look(this.jpeg());
      if (notes && this.stream) this.onNotes(notes, first);
    } finally {
      this.busy = false;
    }
  }
}
