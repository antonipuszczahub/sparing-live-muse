import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Every call to the Meta API is recorded here: model, tokens, cost, latency.
 * Doubles as the hard budget guard and as the evidence trail in the README
 * (docs/MANIFEST.md is generated from manifest.jsonl).
 */
export interface LedgerEntry {
  t: number;
  kind: string;
  model: string;
  session?: string;
  promptTokens?: number;
  cachedTokens?: number;
  completionTokens?: number;
  costUsd: number;
  firstTokenMs?: number;
  totalMs?: number;
}

const FILE = process.env.MANIFEST_PATH || 'data/manifest.jsonl';
const DAILY_LIMIT = Number(process.env.DAILY_BUDGET_USD) || 5;
const SESSION_LIMIT = Number(process.env.SESSION_BUDGET_USD) || 1;

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Today's spend must survive a server restart, otherwise restarting would reset the limit. */
function loadToday(): LedgerEntry[] {
  try {
    const today = day(Date.now());
    return readFileSync(FILE, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as LedgerEntry)
      .filter((e) => day(e.t) === today);
  } catch {
    return [];
  }
}

class Ledger {
  private entries: LedgerEntry[] = loadToday();

  record(e: Omit<LedgerEntry, 't'>): LedgerEntry {
    const entry = { t: Date.now(), ...e };
    this.entries.push(entry);
    try {
      mkdirSync(dirname(FILE), { recursive: true });
      appendFileSync(FILE, JSON.stringify(entry) + '\n');
    } catch {
      // The ledger must never take a call down.
    }
    return entry;
  }

  spentToday(): number {
    const today = day(Date.now());
    return this.entries.filter((e) => day(e.t) === today).reduce((s, e) => s + e.costUsd, 0);
  }

  spentBySession(session: string): number {
    return this.entries.filter((e) => e.session === session).reduce((s, e) => s + e.costUsd, 0);
  }

  /** Can a new call start? Calls already in flight are never cut. */
  canSpend(session?: string): { ok: true } | { ok: false; reason: 'daily' | 'session' } {
    if (this.spentToday() >= DAILY_LIMIT) return { ok: false, reason: 'daily' };
    if (session && this.spentBySession(session) >= SESSION_LIMIT) return { ok: false, reason: 'session' };
    return { ok: true };
  }

  summary() {
    const byModel: Record<string, { calls: number; costUsd: number }> = {};
    for (const e of this.entries) {
      const m = (byModel[e.model] ??= { calls: 0, costUsd: 0 });
      m.calls += 1;
      m.costUsd += e.costUsd;
    }
    return { spentToday: this.spentToday(), dailyLimit: DAILY_LIMIT, sessionLimit: SESSION_LIMIT, byModel };
  }
}

export const ledger = new Ledger();
