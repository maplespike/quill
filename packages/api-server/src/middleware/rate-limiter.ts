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
 *     in-process window instead of going unlimited, and the client keeps
 *     reconnecting — so an outage (or losing the start-up race with Redis)
 *     heals by itself instead of leaving the pod degraded until a restart.
 *
 * Usage (Node http / dev-server):
 *   import { rateLimiter } from './middleware/rate-limiter.js';
 *   const rl = new RateLimiter();
 *   await rl.init();
 *   // In request handler: const result = await rl.check(req);
 */

import Redis from 'ioredis';
import { applyCorsAndSecurityHeaders } from '../response.js';
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
  on(event: string, listener: (...args: any[]) => void): unknown;
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
  quit(): Promise<unknown>;
  disconnect(): void;
}

/**
 * Cap on distinct keys held by the in-process window before expired ones are
 * swept, so a flood of unique client IPs cannot grow the map without bound.
 */
const MEMORY_SWEEP_THRESHOLD = 10_000;

/** Ceiling for the reconnect backoff, in milliseconds. */
const RECONNECT_MAX_MS = 5_000;

/**
 * Normalise a peer address for use as a rate-limit key.
 *
 * Handles the three shapes a Node server actually sees: a bare IPv4 or IPv6
 * literal, an IPv4 address with a port (`1.2.3.4:5678`), and the IPv4-mapped
 * IPv6 form the kernel reports for dual-stack sockets (`::ffff:1.2.3.4`).
 * Returns null when there is nothing usable, so callers can fall through.
 */
export function normalizeIp(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null;

  let ip = value.trim();
  if (ip === '') return null;

  // [::1]:5678 — bracketed IPv6 with a port.
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(ip);
  if (bracketed) ip = bracketed[1];

  // 1.2.3.4:5678 — IPv4 with a port.
  const v4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(ip);
  if (v4WithPort) ip = v4WithPort[1];

  // ::ffff:1.2.3.4 — IPv4-mapped IPv6 (dual-stack sockets).
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) ip = mapped[1];

  return ip === '' ? null : ip;
}

export class RateLimiter {
  private client: RedisLikeClient | null = null;
  private connected = false;

  /** In-process sliding window: key -> request timestamps (ms). */
  private memory = new Map<string, number[]>();

  /** One warn per process on Redis failure; repeats are debug. */
  private errorReported = false;

  constructor(private readonly injectedClient?: RedisLikeClient) {}

  /**
   * Initialize the backend.
   *
   * @param url Explicit Redis URL. Defaults to REDIS_URL. Pass an empty
   *            string to force the in-process window.
   */
  async init(url?: string): Promise<void> {
    if (this.client) return;

    const redisUrl = resolveRedisUrl(url);

    if (redisUrl === null) {
      log.info(
        '[rate-limiter] REDIS_URL is not set — enforcing tier limits in-process (per pod). ' +
        'Set REDIS_URL for cluster-wide counters.',
      );
      return;
    }

    const host = redisHostOf(redisUrl);
    const client = (this.injectedClient ?? new Redis(redisUrl, {
      lazyConnect: true,
      // Fail fast while Redis is down, so check() drops to the in-process
      // window at once instead of queueing commands for a host that may
      // never answer.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      // Reconnect forever, backing off to a 5s ceiling. Giving up here
      // (returning null) is what left a pod that lost the start-up race with
      // Redis degraded until its next restart — observed 2026-09-22.
      retryStrategy: (times: number) => Math.min(times * 200, RECONNECT_MAX_MS),
    })) as RedisLikeClient;

    // Keep the client attached across failures: ioredis reconnects behind it
    // and the limiter enforces in-process until the connection is ready.
    this.client = client;

    client.on('ready', () => {
      this.markConnected(host);
    });

    client.on('error', (err: Error) => {
      this.connected = false;
      // One warn per process, then debug: a flapping Redis must not flood logs.
      if (!this.errorReported) {
        this.errorReported = true;
        log.warn(
          { err, host },
          '[rate-limiter] Redis is not answering — enforcing limits in-process and retrying',
        );
      } else {
        log.debug({ err }, '[rate-limiter] Redis error (repeat)');
      }
    });

    client.on('close', () => {
      this.connected = false;
    });

    try {
      await client.connect();
      // A resolved connect() means the socket is up. ioredis also emits
      // 'ready'; markConnected() keeps exactly one log line either way.
      this.markConnected(host);
    } catch (err) {
      log.warn(
        { err, host },
        '[rate-limiter] Redis not reachable yet — enforcing limits in-process until it answers',
      );
    }
  }

  /**
   * Record a live connection. Idempotent: every later transition is owned by
   * the client's own 'error' / 'close' handlers.
   */
  private markConnected(host: string): void {
    if (this.connected) return;
    this.connected = true;
    log.info({ host }, '[rate-limiter] Connected to Redis');
  }

  /**
   * Check if the Redis backend is connected and usable.
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Which backend is enforcing limits: 'redis' (cluster-wide counters) or
   * 'memory' (in-process window).
   */
  backendMode(): LimiterBackend {
    return this.isConnected() ? 'redis' : 'memory';
  }

  /**
   * Extract the client IP from request headers, falling back to the peer
   * address of the socket.
   *
   * `req.ip` is an Express property; the dev server hands over a raw Node
   * IncomingMessage, which carries the peer only as `socket.remoteAddress`.
   * Reading `req.ip` alone silently collapsed every request without an
   * X-Forwarded-For header (in-cluster callers, port-forwards, health probes)
   * into one shared `unknown` bucket — found live while verifying gate
   * A2-REDIS: the only key Redis held was `ratelimit:FREE:unknown`.
   */
  extractIP(req: {
    headers: Record<string, string | string[] | undefined>;
    ip?: string;
    socket?: { remoteAddress?: string };
    connection?: { remoteAddress?: string };
  }): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      const normalized = normalizeIp(ip);
      if (normalized) return normalized;
    }

    return (
      normalizeIp(req.ip) ||
      normalizeIp(req.socket?.remoteAddress) ||
      normalizeIp(req.connection?.remoteAddress) ||
      'unknown'
    );
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

    if (this.isConnected() && this.client) {
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
        if (!this.errorReported) {
          this.errorReported = true;
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
        res.statusCode = 429;
        // The Node listener writes these through sendNodeResponse. This
        // Express-style path is a second early return, so it calls the
        // same helper before ending the response.
        if (res.setHeader) {
          const headers = new Headers();
          headers.set('Content-Type', 'application/json');
          const origin = req.headers?.origin;
          applyCorsAndSecurityHeaders(
            headers,
            Array.isArray(origin) ? origin[0] ?? null : origin ?? null,
            process.env.ENVIRONMENT,
          );
          headers.forEach((value, key) => {
            res.setHeader(key, value);
          });
          res.setHeader('Retry-After', String(result.retryAfter));
        }
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
    this.memory.clear();
  }
}

/** Singleton rate-limiter instance */
export const rateLimiter = new RateLimiter();
