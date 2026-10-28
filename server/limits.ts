import type { Request, RequestHandler } from 'express';

/**
 * Per-visitor rate limit, in memory. The budget ledger caps total spend; this keeps one visitor
 * from using the whole daily budget on twin research (the most expensive call) or on endless sessions.
 */
const hits = new Map<string, number[]>();

export function rateLimit(name: string, max: number, windowMs = 3_600_000): RequestHandler {
  return (req: Request, res, next) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      const retry = Math.ceil((windowMs - (now - recent[0]!)) / 60000);
      res.status(429).json({ error: `Rate limit: try again in about ${retry} min.`, budget: 'session' });
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
