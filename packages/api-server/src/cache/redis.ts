/**
 * Quill — Redis Cache Client
 *
 * Production Redis caching layer with cache-aside pattern and graceful
 * degradation. When Redis is unavailable, all operations fall through
 * without throwing — the caller always gets a usable result.
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

const log = logger;

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class RedisClient {
  private client: Redis | null = null;
  private connected = false;

  /**
   * Default Redis URL. Override via REDIS_URL env var.
   */
  static readonly DEFAULT_URL = 'redis://redis.ai-inference:6379';

  /**
   * Connect to Redis. Errors are logged — the client operates in
   * degraded mode (all operations no-op) if the connection fails.
   */
  async connect(url?: string): Promise<void> {
    if (this.connected) return;

    const redisUrl = url || process.env.REDIS_URL || RedisClient.DEFAULT_URL;

    try {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 3,
        retryStrategy(times: number): number | null {
          if (times > 3) {
            log.warn('[redis] Max connection retries reached — operating without cache');
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      this.client.on('error', (err: Error) => {
        log.warn({ err }, '[redis] Connection error — falling back to direct fetch');
      });

      await this.client.connect();
      this.connected = true;
      log.info('[redis] Connected successfully');
    } catch (err) {
      this.connected = false;
      this.client = null;
      log.warn({ err }, '[redis] Connection failed — operating without cache');
    }
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
   * If Redis is unavailable or throws at any point, fetchFn is called
   * directly (graceful degradation).
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
