// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Redis Cache Client
 *
 * Production Redis caching layer with cache-aside pattern. When Redis is not
 * configured (no REDIS_URL) or is unreachable, every operation is a no-op and
 * callers fetch directly — the caller always gets a usable result.
 *
 * Gate A2-REDIS (#764, #770): the endpoint used to come from a hardcoded
 * `redis://redis.ai-inference:6379` default. That namespace does not exist, so
 * deployments without REDIS_URL logged connection errors forever and the
 * cache silently ran in bypass. The endpoint is now configuration-only (see
 * cache/redis-url.ts); "no REDIS_URL" is logged once at startup and is a
 * deliberate state, not a failure loop. The client also reconnects in the
 * background, so a Redis restart — or losing the start-up race with it — does
 * not leave the API cache-less until someone restarts the pod.
 *
 * Usage:
 *   const redis = new RedisClient();
 *   await redis.connect();
 *   const data = await redis.getCached('my-key', 300, async () => {
 *     return await fetchExpensiveData();
 *   });
 */

import Redis from 'ioredis';
import logger from '../logger.js';
import { resolveRedisUrl, redisHostOf } from './redis-url.js';

const log = logger;

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** Ceiling for the reconnect backoff, in milliseconds. */
const RECONNECT_MAX_MS = 5_000;

export class RedisClient {
  private client: Redis | null = null;
  private connected = false;

  /** One warn per process on Redis failure; repeats are debug. */
  private errorReported = false;

  /**
   * Connect to Redis using REDIS_URL.
   *
   * @param url Explicit URL; defaults to REDIS_URL. Pass an empty string to
   *            force "no cache in this process".
   */
  async connect(url?: string): Promise<void> {
    if (this.client) return;

    const redisUrl = resolveRedisUrl(url);

    if (redisUrl === null) {
      log.info(
        '[redis] REDIS_URL is not set — response cache disabled in this process. ' +
        'Set REDIS_URL to enable it.',
      );
      return;
    }

    const host = redisHostOf(redisUrl);
    const client = new Redis(redisUrl, {
      lazyConnect: true,
      // Fail fast while Redis is down so callers fetch directly instead of
      // queueing commands for a host that may never answer.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      // Reconnect forever, backing off to a 5s ceiling. Giving up here
      // (returning null) is what left a pod that lost the start-up race with
      // Redis serving without a cache until its next restart — 2026-09-22.
      retryStrategy: (times: number) => Math.min(times * 200, RECONNECT_MAX_MS),
    });

    // Keep the client attached across failures: ioredis reconnects behind it.
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
          '[redis] Redis is not answering — serving without cache and retrying',
        );
      } else {
        log.debug({ err }, '[redis] Redis error (repeat)');
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
        '[redis] Redis not reachable yet — serving without cache until it answers',
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
    log.info({ host }, '[redis] Connected successfully');
  }

  /**
   * Check if Redis is currently connected and usable.
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Get a cached value by key. Returns null on miss or error.
   */
  async get<T = string>(key: string): Promise<T | null> {
    if (!this.isConnected()) return null;

    try {
      const raw = await this.client!.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      log.warn({ err, key }, '[redis] GET failed — returning null');
      return null;
    }
  }

  /**
   * Store a value with optional TTL (seconds). If TTL is omitted,
   * the key persists indefinitely.
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (!this.isConnected()) return;

    try {
      const serialized = JSON.stringify(value);
      if (ttl && ttl > 0) {
        await this.client!.setex(key, ttl, serialized);
      } else {
        await this.client!.set(key, serialized);
      }
    } catch (err) {
      log.warn({ err, key }, '[redis] SET failed');
    }
  }

  /**
   * Delete a key from the cache.
   */
  async del(key: string): Promise<void> {
    if (!this.isConnected()) return;

    try {
      await this.client!.del(key);
    } catch (err) {
      log.warn({ err, key }, '[redis] DEL failed');
    }
  }

  /**
   * Cache-aside pattern: check cache first; on miss, call fetchFn,
   * store the result with the given TTL, and return it.
   *
   * If Redis is not configured or throws at any point, fetchFn is called
   * directly.
   *
   * @returns An object with `value` (the fetched/cached data) and
   *          `cacheStatus` ('hit' | 'miss' | 'bypass').
   */
  async getCached<T>(
    key: string,
    ttl: number,
    fetchFn: () => Promise<T>,
  ): Promise<{ value: T; cacheStatus: 'hit' | 'miss' | 'bypass' }> {
    // Bypass: Redis is not connected, skip caching entirely
    if (!this.isConnected()) {
      const value = await fetchFn();
      return { value, cacheStatus: 'bypass' };
    }

    // Check cache
    try {
      const cached = await this.get<{ value: T }>(key);
      if (cached !== null && cached.value !== undefined) {
        return { value: cached.value as T, cacheStatus: 'hit' };
      }
    } catch {
      // Fall through to fetchFn
    }

    // Cache miss — fetch fresh data
    const value = await fetchFn();

    // Store result (fire-and-forget; errors are logged, not thrown)
    this.set(key, { value }, ttl).catch(() => {});

    return { value, cacheStatus: 'miss' };
  }

  /**
   * Disconnect the Redis client gracefully.
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

/** Singleton Redis client instance shared across the API server */
export const redisClient = new RedisClient();
