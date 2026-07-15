/**
 * Quill — Redis-backed Rate Limiter
 *
 * Sliding window counter using Redis for distributed rate limiting.
 * Tier-based limits, graceful degradation, and standard rate-limit headers.
 *
 * Usage (Express-style):
 *   app.use(rateLimiter);
 *
 * Usage (Node http / dev-server):
 *   import { rateLimiter } from './middleware/rate-limiter.js';
 *   const rl = new RateLimiter();
 *   await rl.init();
 *   // In request handler: const result = await rl.check(req);
 */

import Redis from 'ioredis';
import logger from '../logger.js';

const log = logger;

export type Tier = 'FREE' | 'BASIC' | 'PREMIUM';

/** Per-minute rate limits per tier */
export const TIER_LIMITS: Record<Tier, number> = {
  FREE: 100,
  BASIC: 1000,
  PREMIUM: 10000,
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number; // unix seconds
  retryAfter: number; // seconds
}

export class RateLimiter {
  private client: Redis | null = null;
  private connected = false;

  /**
   * Default Redis URL. Override via REDIS_URL env var.
   */
  static readonly DEFAULT_URL = 'redis://redis.ai-inference:6379';

  /**
   * Initialize the Redis connection. If it fails, the limiter operates
   * in pass-through mode (all requests allowed, graceful degradation).
   */
  async init(url?: string): Promise<void> {
    if (this.connected) return;

    const redisUrl = url || process.env.REDIS_URL || RateLimiter.DEFAULT_URL;

    try {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 2,
        retryStrategy(times: number): number | null {
          if (times > 2) {
            log.warn('[rate-limiter] Max retries reached — operating in pass-through mode');
            return null;
          }
          return Math.min(times * 200, 1000);
        },
      });

      this.client.on('error', (err: Error) => {
        log.warn({ err }, '[rate-limiter] Redis error — allowing request');
      });

      await this.client.connect();
      this.connected = true;
      log.info('[rate-limiter] Connected to Redis');
    } catch (err) {
      this.connected = false;
      this.client = null;
      log.warn({ err }, '[rate-limiter] Connection failed — pass-through mode');
    }
  }

  /**
   * Check if Redis is connected.
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Extract the client IP from request headers, falling back to a default.
   */
  extractIP(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ip?.trim() || 'unknown';
    }
    return req.ip || 'unknown';
  }

  /**
   * Determine the caller's tier.
   * Checks x-api-key header for key prefix conventions, then falls back
   * to req.user?.plan if that pattern is used.
   */
  extractTier(req: { headers: Record<string, string | string[] | undefined>; user?: { plan?: string } }): Tier {
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      const key = Array.isArray(apiKey) ? apiKey[0] : apiKey;
      if (key.startsWith('msk_basic_')) return 'BASIC';
      if (key.startsWith('msk_premium_') || key.startsWith('msk_enterprise_')) return 'PREMIUM';
    }
    // Fallback to user.plan if set by auth middleware
    if (req.user?.plan) {
      const plan = req.user.plan.toUpperCase();
      if (plan === 'BASIC') return 'BASIC';
      if (plan === 'PREMIUM' || plan === 'ENTERPRISE') return 'PREMIUM';
    }
    return 'FREE';
  }

  /**
   * Sliding window rate check using Redis.
   *
   * Uses a sorted set with timestamps as scores. The Lua script atomically:
   *   1. Removes entries older than the window
   *   2. Counts remaining entries
   *   3. If under limit, adds current entry and sets TTL
   *   4. Returns (allowed, count, oldest_timestamp)
   *
   * Lua script (SHA-cached for performance):
   *   KEYS[1] = rate-limit key (namespace:tier:ip)
   *   ARGV[1] = limit (max requests)
   *   ARGV[2] = window seconds (60)
   *   ARGV[3] = now (unix seconds)
   */
  private slidingWindowLua = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local cutoff = now - window

    -- Remove expired entries
    redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)

    -- Count remaining entries
    local count = redis.call('ZCARD', key)

    local oldest = now
    local first_entry = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    if #first_entry > 0 then
      oldest = tonumber(first_entry[2])
    end

    if count >= limit then
      return {0, count, oldest + window}
    end

    -- Add current entry
    redis.call('ZADD', key, now, now)
    redis.call('EXPIRE', key, window)

    return {1, count + 1, oldest + window}
  `;

  /**
   * Run a rate-limit check for the given request.
   *
   * @returns RateLimitResult with status info, or null if Redis is down
   *          (graceful degradation — allow request).
   */
  async check(
    ip: string,
    tier: Tier,
  ): Promise<RateLimitResult | null> {
    if (!this.isConnected()) return null; // pass-through

    const limit = TIER_LIMITS[tier];
    const windowSeconds = 60;
    const now = Math.floor(Date.now() / 1000);
    const key = `ratelimit:${tier}:${ip}`;

    try {
      const result = await this.client!.eval(
        this.slidingWindowLua,
        1,
        key,
        String(limit),
        String(windowSeconds),
        String(now),
      ) as [number, number, number];

      const [allowed, count, resetTime] = result;

      return {
        allowed: allowed === 1,
        limit,
        remaining: Math.max(0, limit - count),
        resetTime,
        retryAfter: Math.max(0, resetTime - now),
      };
    } catch (err) {
      log.warn({ err }, '[rate-limiter] Redis eval failed — allowing request');
      return null; // graceful degradation
    }
  }

  /**
   * Express-style middleware function.
   * Call this to create a middleware handler compatible with connect/express patterns.
   */
  middleware() {
    const self = this;
    return async (req: any, res: any, next: () => void): Promise<void> => {
      // Exempt health endpoint
      if (req.url?.startsWith('/v1/health')) {
        return next();
      }

      const ip = self.extractIP(req);
      const tier = self.extractTier(req);
      const result = await self.check(ip, tier);

      // Graceful degradation — if Redis is down, allow
      if (result === null) {
        return next();
      }

      // Set rate-limit headers
      if (res.setHeader) {
        res.setHeader('X-RateLimit-Limit', String(result.limit));
        res.setHeader('X-RateLimit-Remaining', String(result.remaining));
        res.setHeader('X-RateLimit-Reset', String(result.resetTime));
      }

      if (!result.allowed) {
        if (res.setHeader) {
          res.setHeader('Retry-After', String(result.retryAfter));
        }
        res.statusCode = 429;
        res.setHeader?.('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'rate_limit_exceeded',
          retry_after: result.retryAfter,
        }));
        return;
      }

      next();
    };
  }

  /**
   * Disconnect Redis client gracefully.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.client = null;
      this.connected = false;
    }
  }
}

/** Singleton rate-limiter instance */
export const rateLimiter = new RateLimiter();
