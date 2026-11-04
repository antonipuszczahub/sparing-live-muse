import type { Request, RequestHandler } from 'express';

/**
 * Per-visitor rate limit, in memory. The budget ledger caps total spend; this keeps one visitor
 * from using the whole daily budget on twin research (the most expensive call) or on endless sessions.
 */
const hits = new Map<string, number[]>();

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Requests from this very machine (the owner rehearsing, or a phone reaching the dev server through `tailscale serve`,
 * which also arrives from 127.0.0.1) are not limited: a recording session with many takes must not run into a
 * "try again in 40 minutes". A production deployment (NODE_ENV=production, as in the Dockerfile) limits everyone.
 */
const exempt = (ip: string | undefined) => process.env.NODE_ENV !== 'production' && ip !== undefined && LOOPBACK.has(ip);

export function rateLimit(name: string, max: number, windowMs = 3_600_000): RequestHandler {
  return (req: Request, res, next) => {
    if (exempt(req.ip)) return next();
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
