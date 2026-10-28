import type { Lang } from '../../shared/types.ts';

/**
 * ElevenLabs as the character's voice. The browser's own voices are the fallback, so every failure
 * here is reported with a code the client can act on ("limit", "quota", "auth", "unavailable").
 * The key stays on the server; the browser asks /api/tts for audio.
 */
export interface TtsConfig {
  key: string;
  model: string;
  baseUrl: string;
  /** Price used for the cost estimate, from https://elevenlabs.io/pricing/api (v4 Turbo and Flash: $0.04 per 1K characters). */
  usdPer1k: number;
}

export function ttsConfig(env: NodeJS.ProcessEnv = process.env): TtsConfig | null {
  const key = env.ELEVENLABS_API_KEY?.trim();
  if (!key) return null;
  return {
    key,
    model: env.ELEVENLABS_MODEL?.trim() || 'eleven_v4_turbo',
    baseUrl: (env.ELEVENLABS_BASE_URL?.trim() || 'https://api.elevenlabs.io').replace(/\/$/, ''),
    usdPer1k: Number(env.ELEVENLABS_USD_PER_1K_CHARS) || 0.04,
  };
}

export const ttsCostUsd = (chars: number, usdPer1k: number): number => (chars / 1000) * usdPer1k;

export interface CloudVoice {
  id: string;
  name: string;
  gender: 'm' | 'f' | null;
  accent?: string;
  /** The voice is verified for the language, as opposed to an English voice that is made to speak it. */
  native: boolean;
  previewUrl?: string;
  /** The voice cannot be used with this account's plan (library voices on the free plan). */
  locked?: boolean;
  /** One of ElevenLabs' standard voices, available on every plan. */
  premade?: boolean;
}

export class TtsError extends Error {
  constructor(
    public code: 'auth' | 'quota' | 'limit' | 'plan' | 'unavailable',
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

interface RawVoice {
  voice_id?: string;
  name?: string;
  category?: string;
  preview_url?: string;
  labels?: Record<string, string>;
  verified_languages?: { language?: string; locale?: string; accent?: string }[];
}

/** Library voices (everything but the premade ones) need a paid plan to be used through the API. */
export const FREE_TIER = 'free';

/** The accents voices are labelled with, and the language each one speaks natively. */
const ACCENT_LANG: [string, Lang][] = [['polish', 'pl'], ['american', 'en'], ['british', 'en'], ['australian', 'en'], ['irish', 'en'], ['canadian', 'en'], ['scottish', 'en']];

/** Turns the API's voice list into what the picker needs. Pure, so it is tested without the network. */
export function toCloudVoices(raw: RawVoice[], lang: Lang, tier?: string): CloudVoice[] {
  const rank = new Map<string, number>();
  const voices = raw
    .filter((v) => v.voice_id && v.name)
    .map((v): CloudVoice => {
      const g = v.labels?.gender?.toLowerCase();
      const accent = v.labels?.accent?.toLowerCase();
      const accentLang = accent ? ACCENT_LANG.find(([a]) => accent.includes(a))?.[1] : undefined;
      const native =
        (v.verified_languages ?? []).some((l) => l.language === lang || l.locale?.toLowerCase().startsWith(lang)) || v.labels?.language === lang || accentLang === lang;
      // A voice made for the language, then one we know nothing about, then one made for another language.
      const verifiedElsewhere = (v.verified_languages ?? []).length > 0 && !native;
      rank.set(v.voice_id!, native ? 2 : accentLang || verifiedElsewhere ? 0 : 1);
      return {
        id: v.voice_id!,
        name: v.name!,
        gender: g === 'male' ? 'm' : g === 'female' ? 'f' : null,
        accent: v.labels?.accent,
        native,
        previewUrl: v.preview_url,
        premade: v.category === 'premade',
        locked: tier === FREE_TIER && v.category !== 'premade',
      };
    });
  return voices.sort((a, b) => rank.get(b.id)! - rank.get(a.id)! || a.name.localeCompare(b.name));
}

/** The voice used when the user has not picked one: an env override, else the first voice of the right gender. */
export function defaultVoices(voices: CloudVoice[], lang: Lang, env: NodeJS.ProcessEnv = process.env): { m: string | null; f: string | null } {
  const pick = (g: 'm' | 'f') => {
    const override = env[`ELEVENLABS_VOICE_${lang.toUpperCase()}_${g.toUpperCase()}`]?.trim();
    return override || voices.find((v) => v.gender === g && !v.locked)?.id || null;
  };
  return { m: pick('m'), f: pick('f') };
}

const cache = new Map<string, { at: number; voices: RawVoice[]; tier?: string }>();

/** The plan of the account ("free", "starter", ...), or undefined when it cannot be read. */
async function planOf(cfg: TtsConfig, fetchFn: typeof fetch): Promise<string | undefined> {
  const res = await fetchFn(`${cfg.baseUrl}/v1/user/subscription`, { headers: { 'xi-api-key': cfg.key } }).catch(() => null);
  if (!res?.ok) return undefined;
  return ((await res.json().catch(() => ({}))) as { tier?: string }).tier;
}

/** The voices of the account, kept for ten minutes. Tries the current endpoint, then the older one. */
export async function listVoices(cfg: TtsConfig, lang: Lang, fetchFn: typeof fetch = fetch): Promise<CloudVoice[]> {
  const hit = cache.get(cfg.baseUrl);
  if (hit && Date.now() - hit.at < 600_000) return toCloudVoices(hit.voices, lang, hit.tier);
  let raw: RawVoice[] | null = null;
  for (const path of ['/v2/voices?page_size=100', '/v1/voices']) {
    const res = await fetchFn(`${cfg.baseUrl}${path}`, { headers: { 'xi-api-key': cfg.key } }).catch(() => null);
    if (!res) continue;
    if (res.status === 401) throw new TtsError('auth', 'ElevenLabs rejected the API key', 502);
    if (!res.ok) continue;
    raw = ((await res.json()) as { voices?: RawVoice[] }).voices ?? [];
    break;
  }
  if (!raw) throw new TtsError('unavailable', 'Could not list the ElevenLabs voices');
  const tier = await planOf(cfg, fetchFn);
  cache.set(cfg.baseUrl, { at: Date.now(), voices: raw, tier });
  return toCloudVoices(raw, lang, tier);
}

export interface SpeakInput {
  voiceId: string;
  text: string;
  lang: Lang;
  /** The sentence before this one, so the voice continues instead of restarting its intonation. */
  previous?: string;
  signal?: AbortSignal;
}

// Models differ in which optional fields they accept. When one is refused, learn it once per model and
// leave it out from then on, instead of failing every sentence of every call.
const refused = new Map<string, Set<'language_code' | 'previous_text' | 'voice_settings'>>();

const FIELD_HINTS: [RegExp, 'language_code' | 'previous_text' | 'voice_settings'][] = [
  [/language/i, 'language_code'],
  [/previous/i, 'previous_text'],
  [/voice_settings|stability|similarity|speed|style/i, 'voice_settings'],
];

/** Starts the synthesis and returns the response, whose body is raw 16-bit PCM at 24 kHz, streamed. */
export async function speak(cfg: TtsConfig, input: SpeakInput, fetchFn: typeof fetch = fetch): Promise<Response> {
  const skip = refused.get(cfg.model) ?? new Set();
  refused.set(cfg.model, skip);
  const call = () =>
    fetchFn(`${cfg.baseUrl}/v1/text-to-speech/${encodeURIComponent(input.voiceId)}/stream?output_format=pcm_24000`, {
      method: 'POST',
      headers: { 'xi-api-key': cfg.key, 'Content-Type': 'application/json', Accept: 'audio/pcm' },
      body: JSON.stringify({
        text: input.text,
        model_id: cfg.model,
        ...(skip.has('language_code') ? {} : { language_code: input.lang }),
        ...(input.previous && !skip.has('previous_text') ? { previous_text: input.previous } : {}),
        ...(skip.has('voice_settings') ? {} : { voice_settings: { stability: 0.45, similarity_boost: 0.75, speed: 1 } }),
      }),
      signal: input.signal,
    });

  let res = await call();
  // A 400/422 that names an optional field: drop the fields it names and try again, up to once per field.
  for (let attempt = 0; attempt < 3 && (res.status === 400 || res.status === 422); attempt++) {
    const detail = await res.clone().text().catch(() => '');
    const named = FIELD_HINTS.filter(([re, field]) => re.test(detail) && !skip.has(field)).map(([, field]) => field);
    if (!named.length) break;
    named.forEach((f) => skip.add(f));
    res = await call();
  }
  if (res.ok) return res;
  const detail = (await res.text().catch(() => '')).slice(0, 200);
  if (res.status === 401) throw new TtsError('auth', 'ElevenLabs rejected the API key');
  if (/paid_plan_required|library voices/i.test(detail)) throw new TtsError('plan', 'This voice needs a paid ElevenLabs plan', 402);
  if (res.status === 402 || res.status === 429 || /quota/i.test(detail)) throw new TtsError('quota', 'The ElevenLabs quota is used up', 429);
  throw new TtsError('unavailable', `ElevenLabs ${res.status}: ${detail}`);
}
