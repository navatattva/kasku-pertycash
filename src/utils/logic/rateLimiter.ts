export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
  retryAfterSec: number;
}

export class SlidingWindowRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();

  constructor(maxRequests = 60, windowMs = 60_000) {
    this.maxRequests = Math.max(1, maxRequests);
    this.windowMs = Math.max(1000, windowMs);
  }

  consume(
    key: string,
    maxRequests: number = this.maxRequests,
    windowMs: number = this.windowMs,
    nowMs: number = Date.now()
  ): RateLimitResult {
    const effectiveMax = Math.max(1, maxRequests);
    const effectiveWindow = Math.max(1000, windowMs);
    const windowStart = nowMs - effectiveWindow;
    const prev = this.hits.get(key) ?? [];
    const active = prev.filter((ts) => ts > windowStart);

    if (active.length >= effectiveMax) {
      const oldestTs = active[0] ?? nowMs;
      const resetAtMs = oldestTs + effectiveWindow;
      const retryAfterSec = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));
      this.hits.set(key, active);
      return {
        allowed: false,
        limit: effectiveMax,
        remaining: 0,
        resetAtMs,
        retryAfterSec,
      };
    }

    const updated = [...active, nowMs];
    this.hits.set(key, updated);
    const oldestTs = updated[0] ?? nowMs;
    const resetAtMs = oldestTs + effectiveWindow;

    // Periodic pruning when map grows large
    if (this.hits.size > 2000) {
      for (const [entryKey, timestamps] of this.hits.entries()) {
        if (timestamps.length === 0 || timestamps[timestamps.length - 1] <= windowStart) {
          this.hits.delete(entryKey);
        }
      }
    }

    return {
      allowed: true,
      limit: effectiveMax,
      remaining: Math.max(0, effectiveMax - updated.length),
      resetAtMs,
      retryAfterSec: 0,
    };
  }

  reset(key?: string): void {
    if (key) {
      this.hits.delete(key);
    } else {
      this.hits.clear();
    }
  }
}
