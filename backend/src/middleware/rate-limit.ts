import { NextFunction, Request, Response } from 'express';
import { AppError } from './error-handler';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding window. Fine for a single-instance pilot; the architecture
 * calls for Redis-backed limiting once the API runs behind a load balancer,
 * since each instance would otherwise keep its own count.
 */
const buckets = new Map<string, Bucket>();

export function rateLimit(opts: { windowMs: number; max: number; key?: string }) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const id = `${opts.key ?? req.path}:${req.ip}`;
    const now = Date.now();
    const bucket = buckets.get(id);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(id, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    if (bucket.count >= opts.max) {
      const seconds = Math.ceil((bucket.resetAt - now) / 1000);
      return next(
        new AppError(429, 'RATE_LIMITED', `Too many attempts. Try again in ${seconds}s.`),
      );
    }

    bucket.count += 1;
    next();
  };
}

// Entries are only touched on request, so sweep expired ones periodically
// rather than letting the map grow with every unique IP seen.
setInterval(() => {
  const now = Date.now();
  for (const [id, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(id);
  }
}, 60_000).unref();
