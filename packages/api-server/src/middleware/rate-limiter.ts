/**
 * Quill — Rate Limiter (Redis-backed, with an in-memory sliding window)
 *
 * Sliding-window counter using Redis for distributed rate limiting, with an
 * in-process sliding window as the fallback. Tier-based limits, standard
 * rate-limit headers, and no pass-through.
 *
 * Gate A2-REDIS (#764, #770): the limiter used to fall back to a hardcoded
 * `redis://redis.ai-inference:6379` — a host that does not exist — and
 * answered `null` ("allow, do not enforce") whenever Redis was unreachable.
 * A misconfigured or briefly unavailable Redis therefore disabled rate
 * limiting entirely. Now:
 *   - the endpoint comes from REDIS_URL only (see cache/redis-url.ts);
 *   - when Redis is not configured, the limiter enforces the same limits
 *     in-process and says so once, at startup;
 *   - when Redis is configured but drops out, requests fall back to the
 *     in-process window instead of going unlimited.
 *
 * Usage (Node http / dev-server):
 *   import { rateLimiter } from './middleware/rate-limiter.js';
 *   const rl = new RateLimiter();
 *   await rl.init();
 *   // In request handler: const result = await rl.check(req);
 */

import Redis from 'ioredis';
import logger from '../logger.js';
import { resolveRedisUrl, redisHostOf } from '../cache/redis-url.js';

const log = logger;

export type Tier = 'FREE' | 'BASIC' | 'PREMIUM';

/** Per-minute rate limits per tier */
export const TIER_LIMITS: Record<Tier, number> = {
  FREE: 100,
  BASIC: 1000,
  PREMIUM: 10000,
};

/** Sliding-window width, in seconds. */
export const WINDOW_SECONDS = 60;

/** Which backend is enforcing limits right now. */
export type LimiterBackend = 'redis' | 'memory';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number; // unix seconds
  retryAfter: number; // seconds
}

/**
 * The subset of ioredis this limiter uses. Injectable so the result-mapping
 * path can be tested without a live server.
 */
export interface RedisLikeClient {
  connect(): Promise<void>;
  on(event: 'error', listener: (err: Error) => void): unknown;
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
  quit(): Promise<unknown>;
  disconnect(): void;
}

/**
 * Cap on distinct keys held by the in-process window before expired ones are
 * swept, so a flood of unique client IPs cannot grow the map without bound.
 */
const MEMORY_SWEEP_THRESHOLD = 10_000;

export class RateLimiter {
  private client: RedisLikeClient | null = null;
  private connected = false;
  private backend: LimiterBackend = 'memory';

  /** In-process sliding window: key -> request timestamps (ms). */
  private memory = new Map<string, number[]>();

  /** One warn per process on Redis eval failure; repeats are debug. */
  private evalFailureReported = false;

  constructor(private readonly injectedClient?: RedisLikeClient) {}

  /**
   * Initialize the backend.
   *
   * @param url Explicit Redis URL. Defaults to REDIS_URL. Pass an empty
   *            string to force the in-process window.
   */
  async init(url?: string): Promise<void> {
    if (this.connected) return;

    const redisUrl = resolveRedisUrl(url);

    if (redisUrl === null) {
      this.backend = 'memory';
      log.info(
        '[rate-limiter] REDIS_URL is not set — enforcing tier limits in-process (per pod). ' +
        'Set REDIS_URL for cluster-wide counters.',
      );
      return;
    }

    try {
      const client = this.injectedClient ?? new Redis(redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 2,
        retryStrategy(times: number): number | null {
          if (times > 2) {
            log.warn('[rate-limiter] Redis unreachable — enforcing limits in-process');
            return null;
          }
          return Math.min(times * 200, 1000);
        },
      }) as RedisLikeClient;

      let reported = false;
      client.on('error', (err: Error) => {
        // One warn per process, then debug: a flapping Redis must not flood logs.
        if (!reported) {
          reported = true;
          log.warn(
            { err, host: redisHostOf(redisUrl) },
            '[rate-limiter] Redis error — requests fall back to the in-process window',
          );
        } else {
          log.debug({ err }, '[rate-limiter] Redis error (repeat)');
        }
      });

      await client.connect();
      this.client = client;
      this.connected = true;
      this.backend = 'redis';
      log.info({ host: redisHostOf(redisUrl) }, '[rate-limiter] Connected to Redis');
    } catch (err) {
      this.connected = false;
      this.client = null;
      this.backend = 'memory';
      log.warn(
        { err, host: redisHostOf(redisUrl) },
        '[rate-limiter] Redis connection failed — enforcing limits in-process',
      );
    }
  }

  /**
   * Check if the Redis backend is connected.
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Which backend is enforcing limits: 'redis' (cluster-wide counters) or
   * 'memory' (in-process window).
   */
  backendMode(): LimiterBackend {
    return this.backend;
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
   * Always returns a decision: Redis when it is connected, the in-process
   * sliding window otherwise. Never returns null — a limiter that answers
   * "no opinion" is not a limiter.
   *
   * @param nowMs Injectable clock (tests); defaults to Date.now().
   */
  async check(ip: string, tier: Tier, nowMs: number = Date.now()): Promise<RateLimitResult> {
    const limit = TIER_LIMITS[tier];
    const key = `ratelimit:${tier}:${ip}`;

    if (this.connected && this.client) {
      const now = Math.floor(nowMs / 1000);

      try {
        const result = await this.client.eval(
          this.slidingWindowLua,
          1,
          key,
          String(limit),
          String(WINDOW_SECONDS),
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
        // First failure gets a warn; repeats drop to debug so a dead Redis
        // does not turn every request into a log line.
        if (!this.evalFailureReported) {
          this.evalFailureReported = true;
          log.warn(
            { err, key },
            '[rate-limiter] Redis eval failed — falling back to the in-process window',
          );
        } else {
          log.debug({ err, key }, '[rate-limiter] Redis eval failed (repeat)');
        }
      }
    }

    return this.checkInProcess(key, limit, nowMs);
  }

  /**
   * In-process sliding window. Same semantics as the Lua script: entries
   * older than the window are dropped, the window is full at `limit`, and
   * `resetTime` is when the oldest surviving entry ages out.
   */
  private checkInProcess(key: string, limit: number, nowMs: number): RateLimitResult {
    if (this.memory.size > MEMORY_SWEEP_THRESHOLD) {
      this.sweep(nowMs);
    }

    const cutoff = nowMs - WINDOW_SECONDS * 1000;
    const entries = (this.memory.get(key) ?? []).filter((ts) => ts > cutoff);

    const now = Math.floor(nowMs / 1000);
    const oldest = entries.length > 0 ? entries[0] : nowMs;
    const resetTime = Math.floor((oldest + WINDOW_SECONDS * 1000) / 1000);

    if (entries.length >= limit) {
      this.memory.set(key, entries);
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetTime,
        retryAfter: Math.max(0, resetTime - now),
      };
    }

    entries.push(nowMs);
    this.memory.set(key, entries);

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - entries.length),
      resetTime,
      retryAfter: 0,
    };
  }

  /** Drop keys whose entries have all aged out of the window. */
  private sweep(nowMs: number): void {
    const cutoff = nowMs - WINDOW_SECONDS * 1000;
    for (const [key, entries] of this.memory) {
      const live = entries.filter((ts) => ts > cutoff);
      if (live.length === 0) {
        this.memory.delete(key);
      } else {
        this.memory.set(key, live);
      }
    }
  }

  /**
   * Express-style middleware function.
   * Call this to create a middleware handler compatible with connect/express patterns.
   */
  middleware() {
    return async (req: any, res: any, next: () => void): Promise<void> => {
      // Exempt health endpoint
      if (req.url?.startsWith('/v1/health')) {
        return next();
      }

      const ip = this.extractIP(req);
      const tier = this.extractTier(req);
      const result = await this.check(ip, tier);

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
    this.backend = 'memory';
    this.memory.clear();
  }
}

/** Singleton rate-limiter instance */
export const rateLimiter = new RateLimiter();
