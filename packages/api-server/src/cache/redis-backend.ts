/**
 * Quill — Redis Cache Backend
 *
 * Adapter that wraps the existing RedisClient to conform to the
 * CacheBackend interface. Handles connection lifecycle and
 * graceful degradation.
 */

import type { CacheBackend } from './types.js';
import { RedisClient } from './redis.js';
import logger from '../logger.js';

const log = logger;

export class RedisBackend implements CacheBackend {
  private client: RedisClient;

  constructor() {
    this.client = new RedisClient();
  }

  /**
   * Connect to Redis using REDIS_URL (see cache/redis-url.ts).
   * Omitting the URL and leaving REDIS_URL unset leaves the client
   * disconnected: every operation no-ops.
   */
  async connect(url?: string): Promise<void> {
    await this.client.connect(url);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return this.client.get<T>(key);
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.client.set(key, value, ttlSeconds);
  }

  async invalidate(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Cache-aside: check cache first; on miss call fetchFn, store
   * result, and return it. Graceful degradation on Redis errors.
   */
  async getCached<T>(
    key: string,
    ttl: number,
    fetchFn: () => Promise<T>,
  ): Promise<{ value: T; cacheStatus: 'hit' | 'miss' | 'bypass' }> {
    return this.client.getCached(key, ttl, fetchFn);
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
    log.info('[cache] Redis backend disconnected');
  }
}
