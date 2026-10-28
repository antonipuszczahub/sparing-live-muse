import type { Lang } from '../../shared/types.ts';
import { CloudSpeaker } from './cloudSpeaker.ts';
import { cancelBrowserSpeech, speakBrowser } from './tts.ts';

/**
 * The cloud voice (ElevenLabs, through our server): is it on, which voices there are, which one the user
 * chose. Everything here degrades to "not available", and the call then uses the browser's voice.
 */
export interface CloudVoice {
  id: string;
  name: string;
  gender: 'm' | 'f' | null;
  accent?: string;
  native: boolean;
}

export interface CloudCatalog {
  model: string;
  voices: CloudVoice[];
  defaults: { m: string | null; f: string | null };
}

let available: Promise<{ model: string } | null> | null = null;

/** Whether the server has a voice key. Asked once per page load. */
export function cloudAvailable(): Promise<{ model: string } | null> {
  return (available ??= fetch('/api/health')
    .then((r) => r.json())
    .then((h: { voice?: { model: string } | null }) => (h.voice ? { model: h.voice.model } : null))
    .catch(() => null));
}

const catalogs = new Map<Lang, Promise<CloudCatalog | null>>();

export function cloudCatalog(lang: Lang): Promise<CloudCatalog | null> {
  let p = catalogs.get(lang);
  if (!p) {
    p = fetch(`/api/voices?lang=${lang}`)
      .then((r) => (r.ok ? (r.json() as Promise<CloudCatalog>) : null))
      .catch(() => null);
    catalogs.set(lang, p);
    void p.then((c) => c ?? catalogs.delete(lang)); // a failure is retried next time, not remembered
  }
  return p;
}

export function voicesForGender(voices: CloudVoice[], gender: 'm' | 'f'): CloudVoice[] {
  return voices.filter((v) => v.gender === null || v.gender === gender);
}

// ---- what the user chose, kept in this browser
const SOURCE = 'sl.voice.source';
const CHOICE = 'sl.cloudvoice.v1';

export type VoiceSource = 'cloud' | 'browser';

export function getSource(): VoiceSource {
  try {
    return localStorage.getItem(SOURCE) === 'browser' ? 'browser' : 'cloud';
  } catch {
    return 'cloud';
  }
}

export function setSource(source: VoiceSource) {
  try {
    localStorage.setItem(SOURCE, source);
  } catch {
    /* not remembered, still applied for this visit */
  }
}

export function savedCloudVoice(lang: Lang, gender: 'm' | 'f'): string | null {
  try {
    return (JSON.parse(localStorage.getItem(CHOICE) ?? '{}') as Record<string, string>)[`${lang}:${gender}`] ?? null;
  } catch {
    return null;
  }
}

export function saveCloudVoice(lang: Lang, gender: 'm' | 'f', id: string | null) {
  try {
    const all = JSON.parse(localStorage.getItem(CHOICE) ?? '{}') as Record<string, string>;
    if (id) all[`${lang}:${gender}`] = id;
    else delete all[`${lang}:${gender}`];
    localStorage.setItem(CHOICE, JSON.stringify(all));
  } catch {
    /* the choice just is not remembered */
  }
}

/** The cloud voice for a character, or null when the call should use the browser's voice. */
export async function resolveCloudVoice(lang: Lang, gender: 'm' | 'f'): Promise<{ id: string; name: string } | null> {
  if (getSource() === 'browser' || !(await cloudAvailable())) return null;
  const catalog = await cloudCatalog(lang);
  if (!catalog) return null;
  const id = savedCloudVoice(lang, gender) ?? catalog.defaults[gender];
  if (!id) return null;
  return { id, name: catalog.voices.find((v) => v.id === id)?.name ?? id };
}

/** A speaker wired to the real Web Audio and fetch, with the browser voice as its fallback. */
export function createCloudSpeaker(
  session: string,
  lang: Lang,
  voiceId: string,
  browser: { voice: SpeechSynthesisVoice | null; pitch: number },
): CloudSpeaker {
  return new CloudSpeaker(session, lang, voiceId, {
    audio: new AudioContext(),
    fetchFn: (input, init) => fetch(input, init),
    browser: (text) => speakBrowser(text, browser.voice, lang, browser.pitch),
    cancelBrowser: cancelBrowserSpeech,
  });
}

/** Plays a short sample of a voice, for the picker. */
export function previewCloud(voiceId: string, text: string, lang: Lang): CloudSpeaker {
  const speaker = createCloudSpeaker(`preview_${Math.random().toString(36).slice(2, 10)}`, lang, voiceId, { voice: null, pitch: 1 });
  speaker.onIdle = () => speaker.dispose();
  speaker.say(text);
  speaker.finish();
  return speaker;
}
