// SPDX-License-Identifier: AGPL-3.0-only

interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

const limiters = new Map<string, RateLimitEntry>();

export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
  }

  check(key: string): { allowed: boolean; resetAt: Date } {
    const now = new Date();
    const entry = limiters.get(key);

    if (!entry) {
      limiters.set(key, { count: 1, resetAt: new Date(now.getTime() + this.windowMs) });
      return { allowed: true, resetAt: new Date(now.getTime() + this.windowMs) };
    }

    if (now > entry.resetAt) {
      entry.count = 1;
      entry.resetAt = new Date(now.getTime() + this.windowMs);
      return { allowed: true, resetAt: entry.resetAt };
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, resetAt: entry.resetAt };
  }

  reset(key: string): void {
    limiters.delete(key);
  }

  clear(): void {
    limiters.clear();
  }
}

export function createRateLimiter(maxRequests: number, windowMs: number): RateLimiter {
  return new RateLimiter({ maxRequests, windowMs });
}