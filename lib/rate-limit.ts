/**
 * Best-effort in-memory sliding-window rate limiter (EXN-15).
 * On serverless platforms each instance keeps its own counters, so this only
 * bounds abuse per instance — it is not a hard guarantee (spec § 9.6).
 */

const WINDOW_MS = 60_000;

const hits = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(key: string, limitPerMin: number, now = Date.now()): RateLimitResult {
  const windowStart = now - WINDOW_MS;
  const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limitPerMin) {
    const oldest = Math.min(...timestamps);
    const retryAfterSec = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    hits.set(key, timestamps);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  timestamps.push(now);
  hits.set(key, timestamps);

  // Occasional pruning to avoid unbounded growth across keys.
  if (hits.size > 5000) {
    for (const [k, ts] of hits) {
      if (ts.every((t) => t <= windowStart)) hits.delete(k);
    }
  }

  return { allowed: true, remaining: limitPerMin - timestamps.length, retryAfterSec: 0 };
}

export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'unknown';
}

/** Test helper: reset all counters. */
export function resetRateLimit(): void {
  hits.clear();
}
