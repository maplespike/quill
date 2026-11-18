// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Cache Backend Interface & Factory
 *
 * Unified abstraction over memory and Redis caching backends.
 * Provides a common get/set/invalidate contract so that consumers
 * never need to know which backend is active.
 *
 * Factory is config-gated via CACHE_BACKEND or QUILL_CACHE env var:
 *   - "memory" (default): in-memory TTL map (no external deps)
 *   - "redis": Redis-backed via ioredis (requires REDIS_URL — see
 *     cache/redis-url.ts; a missing REDIS_URL means "no Redis", never a
 *     guessed endpoint)
 *
 * Graceful degradation: if Redis is unavailable the factory falls
 * back to memory automatically.
 */

import type { CacheBackend } from './types.js';

export type { CacheBackend } from './types.js';

/**
 * Create a cache backend based on environment configuration.
 *
 * Config sources (first match wins):
 *   1. CACHE_BACKEND env var ("memory" | "redis")
 *   2. QUILL_CACHE env var (same values)
 *   3. Defaults to "memory"
 *
 * When "redis" is selected but the connection fails, the factory
 * falls back to memory and logs a warning.
 */
export async function createCache(): Promise<CacheBackend> {
  const backend =
    (process.env.CACHE_BACKEND ?? process.env.QUILL_CACHE ?? 'memory').toLowerCase();

  if (backend === 'redis') {
    const { RedisBackend } = await import('./redis-backend.js');
    try {
      const redis = new RedisBackend();
      await redis.connect();
      return redis;
    } catch {
      const logger = (await import('../logger.js')).default;
      logger.warn('[cache] Redis unavailable — falling back to memory backend');
      const { MemoryBackend } = await import('./memory-backend.js');
      return new MemoryBackend();
    }
  }

  const { MemoryBackend } = await import('./memory-backend.js');
  return new MemoryBackend();
}
