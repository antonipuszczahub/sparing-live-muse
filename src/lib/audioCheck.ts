/**
 * The audio check: which microphone and which output the call will use, whether the output looks like headphones,
 * whether the microphone hears the user, and whether it hears the character's own voice (the call would then be talking
 * to itself). The judging functions are pure and tested; `runAudioCheck` is the thin layer over Web Audio and speech
 * synthesis that feeds them.
 */
import { looksVirtual, openMic } from './mic.ts';

// ---- what the devices are called -------------------------------------------------------------------------------

export type OutputKind = 'headphones' | 'speakers' | 'virtual' | 'unknown';

/** A guess from the device name. The browser cannot tell whether a plug is in the jack, only what the output is called. */
export function classifyOutput(label: string): OutputKind {
  if (!label) return 'unknown';
  if (looksVirtual(label)) return 'virtual';
  if (/head(phone|set)|ear(phone|bud|piece)|airpods|\bbuds\b|hands-?free|słuchawk|jabra|bluetooth/i.test(label)) return 'headphones';
  if (/speaker|głośnik|display audio|hdmi|monitor|\btv\b|soundbar/i.test(label)) return 'speakers';
  return 'unknown';
}

export interface OutputInfo {
  label: string;
  kind: OutputKind;
}

/** The output the call will play on: the browser's speech synthesis always uses the system default output. */
export async function defaultOutput(): Promise<OutputInfo | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return null;
  const outs = (await navigator.mediaDevices.enumerateDevices().catch(() => [])).filter((d) => d.kind === 'audiooutput');
  const d = outs.find((o) => o.deviceId === 'default') ?? outs[0];
  if (!d?.label) return null;
  const label = d.label.replace(/^default\s*-\s*/i, '');
  return { label, kind: classifyOutput(label) };
}

// ---- judging levels (all values are RMS, 0 to 1) -------------------------------------------------------------------

export function rmsOf(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / samples.length);
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(p * v.length))]!;
}

/** Quiet room level, the 80th percentile so a click or a cough does not set the bar. */
const ambient = (frames: number[]) => percentile(frames, 0.8);
/** The sound floor below which nothing counts as a voice, whatever the room was like. */
const FLOOR = 0.012;

/** Did the microphone hear a person speaking? Clearly above the room and above the floor, for a few frames. */
export function heardVoice(room: number[], speaking: number[]): boolean {
  const bar = Math.max(FLOOR, ambient(room) * 2.5);
  return speaking.filter((x) => x >= bar).length >= 3;
}

/**
 * Did the microphone pick up the character's own voice while the user kept silent? The sound during the sample has to
 * stand clear of the room: speakers next to an open microphone, or a mixer input that carries the system sound.
 */
export function heardOwnVoice(room: number[], duringSample: number[]): boolean {
  const bar = Math.max(FLOOR, ambient(room) * 2.5);
  return duringSample.filter((x) => x >= bar).length >= 5;
}

export type Verdict = { voice: boolean; echo: boolean };

// ---- the I/O layer -------------------------------------------------------------------------------------------------

export type Phase = 'room' | 'speak' | 'sample' | 'done';

export interface CheckHooks {
  /** Plays the sample line with the character's voice and resolves when it has been spoken. */
  speakSample: () => Promise<void>;
  onPhase: (phase: Phase) => void;
  /** The current microphone level, 0 to 1, about 20 times a second. */
  onLevel: (level: number) => void;
}

const FRAME_MS = 50;

/** Collects microphone levels for `ms` (or until `until` settles, when given), reporting each frame. */
async function listen(analyser: AnalyserNode, ms: number, onLevel: (l: number) => void, until?: Promise<void>): Promise<number[]> {
  const buf = new Float32Array(analyser.fftSize);
  const frames: number[] = [];
  let stop = false;
  void until?.then(() => (stop = true));
  const t0 = Date.now();
  while (!stop && Date.now() - t0 < ms) {
    analyser.getFloatTimeDomainData(buf);
    const r = rmsOf(buf);
    frames.push(r);
    onLevel(Math.min(1, r * 6));
    await new Promise((res) => setTimeout(res, FRAME_MS));
  }
  return frames;
}

/**
 * The whole check, with the same microphone choice and constraints a call uses: a second of room noise, three seconds
 * of the user speaking, then the character's sample line while the user stays silent.
 */
export async function runAudioCheck(hooks: CheckHooks): Promise<Verdict> {
  const stream = await openMic();
  const ctx = new AudioContext();
  await ctx.resume().catch(() => undefined);
  try {
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);

    hooks.onPhase('room');
    const room = await listen(analyser, 1000, hooks.onLevel);
    hooks.onPhase('speak');
    const speaking = await listen(analyser, 3000, hooks.onLevel);
    hooks.onPhase('sample');
    const spoken = hooks.speakSample();
    const during = await listen(analyser, 6000, hooks.onLevel, spoken.catch(() => undefined));
    // the tail of the sound can still be in the room a moment after the voice stops
    await spoken.catch(() => undefined);
    during.push(...(await listen(analyser, 400, hooks.onLevel)));
    hooks.onPhase('done');
    return { voice: heardVoice(room, speaking), echo: heardOwnVoice(room, during) };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => undefined);
    hooks.onLevel(0);
  }
}
