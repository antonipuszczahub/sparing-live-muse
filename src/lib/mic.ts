/**
 * Which microphone the call listens to. By default the browser's own default input, but a setup with a virtual audio
 * mixer (Voicemeeter, a virtual cable, "Stereo Mix") can make that default carry the speakers' sound, so the character
 * hears itself and never the user. The user can pick the real (headset) microphone; the choice is kept in this browser.
 */
const KEY = 'sl.mic.v1';

export function savedMic(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveMic(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* the choice just is not remembered */
  }
}

const BASE = { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } as const;

/** What to ask the browser for. A chosen device is requested exactly; without one the browser's default is used. */
export function micConstraints(deviceId: string | null): MediaTrackConstraints {
  return deviceId ? { ...BASE, deviceId: { exact: deviceId } } : { ...BASE };
}

type GetUserMedia = (c: MediaStreamConstraints) => Promise<MediaStream>;

/**
 * Opens the microphone for a call. If the chosen device has gone (unplugged, renamed by a driver) the call falls back to
 * the default input instead of failing; a refused permission is still an error, because the default would be refused too.
 */
export async function openMic(
  getUserMedia: GetUserMedia = (c) => navigator.mediaDevices.getUserMedia(c),
  deviceId: string | null = savedMic(),
): Promise<MediaStream> {
  try {
    return await getUserMedia({ audio: micConstraints(deviceId) });
  } catch (e) {
    const gone = e instanceof DOMException && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError');
    if (deviceId && gone) return getUserMedia({ audio: micConstraints(null) });
    throw e;
  }
}

/** A device name that suggests a virtual input: it may carry what the speakers play, not a person's voice. */
export function looksVirtual(label: string): boolean {
  return /voicemeeter|vb-audio|virtual|stereo mix|what u hear|loopback|\bcable\b|monitor of/i.test(label);
}

export interface Mic {
  id: string;
  label: string;
}

/** The audio inputs the browser knows. Names stay empty until the microphone has been allowed once. */
export async function listMics(): Promise<Mic[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  return all.filter((d) => d.kind === 'audioinput').map((d) => ({ id: d.deviceId, label: d.label }));
}
