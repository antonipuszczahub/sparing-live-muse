import type { AuditResult } from '../../shared/audit.ts';
import type { SessionConfig, Turn } from '../../shared/types.ts';

export class ApiError extends Error {
  constructor(message: string, public budget?: 'daily' | 'session') {
    super(message);
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The audit takes tens of seconds; retry once on a gateway error (server restart, cold start). */
export async function requestAudit(body: {
  session: string;
  config: SessionConfig;
  turns: Turn[];
  durationMs: number;
  hungUp: boolean;
}): Promise<AuditResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) return (await res.json()) as AuditResult;
      const err = (await res.json().catch(() => ({}))) as { error?: string; budget?: 'daily' | 'session' };
      if ((res.status === 502 || res.status === 504) && attempt === 0) {
        await wait(3000);
        continue;
      }
      throw new ApiError(err.error ?? `Audit failed (${res.status})`, err.budget);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (attempt === 0) {
        await wait(3000);
        continue;
      }
      throw new ApiError('Could not reach the server.');
    }
  }
}
