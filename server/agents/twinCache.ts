import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Lang, ScenarioId, TwinProfile } from '../../shared/types.ts';
import type { ResponseStep } from '../meta/responses.ts';
import { buildTwin, type TwinInput } from './twin.ts';

/**
 * Researching a company costs about 20 cents and 30 seconds. The same company, scenario and pitch
 * gives the same twin for a day, so the answer is kept and the research steps are replayed.
 * Only public-web findings are stored, never audio or transcripts.
 */
interface Entry {
  twin: TwinProfile;
  steps: ResponseStep[];
  at: number;
}

/** "https://www.Basecamp.com/about/" and "basecamp.com" are the same company; "Acme Corp" stays a name. */
export function normalizeCompany(input: string): string {
  const s = input.trim().toLowerCase();
  if (/\s/.test(s)) return s.replace(/\s+/g, ' ');
  return s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');
}

/** The research is written up in the call's language, so it is part of the key; English keys are unchanged. */
export function twinKey(input: { company: string; scenario: ScenarioId; topic: string; lang?: Lang; gender?: 'm' | 'f' }): string {
  const topic = input.topic.trim().toLowerCase().replace(/\s+/g, ' ');
  // Polish text about a person agrees with their gender, so a woman's profile is not served to a man.
  const lang = input.lang && input.lang !== 'en' ? `|${input.lang}|${input.gender ?? ''}` : '';
  return createHash('sha1').update(`${input.scenario}|${normalizeCompany(input.company)}|${topic}${lang}`).digest('hex').slice(0, 16);
}

export class TwinCache {
  private memory = new Map<string, Entry>();

  constructor(
    private dir: string,
    private ttlMs: number,
    private now: () => number = Date.now,
  ) {}

  get(key: string): Entry | null {
    let entry = this.memory.get(key) ?? null;
    if (!entry) {
      try {
        entry = JSON.parse(readFileSync(join(this.dir, `${key}.json`), 'utf8')) as Entry;
      } catch {
        return null;
      }
    }
    if (this.now() - entry.at > this.ttlMs) return null;
    this.memory.set(key, entry);
    return entry;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  put(key: string, entry: Entry): void {
    this.memory.set(key, entry);
    try {
      if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
      writeFileSync(join(this.dir, `${key}.json`), JSON.stringify(entry));
    } catch {
      // The cache is an optimisation; failing to write it must not fail the research.
    }
  }
}

export const twinCache = new TwinCache(process.env.TWIN_CACHE_DIR || 'data/twins', (Number(process.env.TWIN_CACHE_HOURS) || 24) * 3_600_000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ago(ms: number, lang: Lang): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (lang === 'pl') return min < 90 ? `${min} min temu` : `${Math.round(min / 60)} godz. temu`;
  return min < 90 ? `${min} min ago` : `${Math.round(min / 60)} h ago`;
}

const REPLAY_NOTE: Record<Lang, (when: string) => string> = {
  en: (when) => `Using the research done ${when}. The web was not searched again.`,
  pl: (when) => `Korzystam z badania wykonanego ${when}. Sieć nie była przeszukiwana ponownie.`,
};

export interface Research {
  twin: TwinProfile;
  cached: boolean;
}

export interface ResearchOptions {
  /** null skips the cache entirely (always research fresh). */
  cache?: TwinCache | null;
  build?: typeof buildTwin;
  /** Delay between replayed steps, so the screen shows the research instead of flashing past. */
  paceMs?: number;
}

/** Cached twin if there is one (steps replayed, clearly labelled), otherwise a fresh research that is then kept. */
export async function researchTwin(input: TwinInput, onStep: (s: ResponseStep) => void, opts: ResearchOptions = {}): Promise<Research> {
  const cache = opts.cache === undefined ? twinCache : opts.cache;
  const build = opts.build ?? buildTwin;
  const key = twinKey(input);

  const hit = cache?.get(key);
  if (hit) {
    const lang = input.lang ?? 'en';
    onStep({ kind: 'note', text: REPLAY_NOTE[lang](ago(Date.now() - hit.at, lang)) });
    const pace = opts.paceMs ?? Math.min(250, 3000 / Math.max(1, hit.steps.length));
    for (const s of hit.steps) {
      if (input.signal?.aborted) break;
      onStep(s);
      if (pace) await sleep(pace);
    }
    return { twin: hit.twin, cached: true };
  }

  const steps: ResponseStep[] = [];
  const twin = await build(input, (s) => {
    if (steps.length < 40) steps.push(s);
    onStep(s);
  });
  cache?.put(key, { twin, steps, at: Date.now() });
  return { twin, cached: false };
}
