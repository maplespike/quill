// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — In-Memory Cache
 *
 * Simple TTL-based cache with hit/miss tracking for cacheStatus reporting.
 * Bounded by `QUILL_CACHE_MAX_ENTRIES` (default 1000) to prevent unbounded
 * growth in long-running workers — when full, oldest entries are evicted.
 * Can be upgraded to Redis later.
 */

interface CacheEntry {
  value: unknown;
  expires: number; // epoch ms, Infinity for no expiry
  /** Monotonically-increasing insertion id — used for LRU eviction. */
  insertedAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
}

function readMaxEntries(): number {
  const raw = (typeof process !== 'undefined' ? process.env?.QUILL_CACHE_MAX_ENTRIES : undefined) ??
              (typeof process !== 'undefined' ? process.env?.QUILL_LIVEPIPELINE_CACHE_MAX ?? '1000' : '1000');
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private maxEntries: number;
  private insertionCounter = 0;

  constructor(maxEntries?: number) {
    this.maxEntries = maxEntries ?? readMaxEntries();
  }

  /**
   * Get a cached value. Returns null if missing or expired.
   */
  get<T = unknown>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (entry.expires <= Date.now()) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value as T;
  }

  /**
   * Store a value with optional TTL in seconds. If the cache is at capacity,
   * the oldest entry (by insertion time) is evicted first.
   */
  set(key: string, value: unknown, ttlSeconds?: number): void {
    const expires = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity;
    if (this.store.has(key)) {
      this.store.set(key, { value, expires, insertedAt: ++this.insertionCounter });
      return;
    }
    if (this.store.size >= this.maxEntries) {
      // Evict the oldest by insertionAt to make room.
      let oldestKey: string | null = null;
      let oldestAt = Number.POSITIVE_INFINITY;
      for (const [k, e] of this.store) {
        if (e.insertedAt < oldestAt) {
          oldestAt = e.insertedAt;
          oldestKey = k;
        }
      }
      if (oldestKey !== null) {
        this.store.delete(oldestKey);
        this.evictions++;
      }
    }
    this.store.set(key, { value, expires, insertedAt: ++this.insertionCounter });
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expires <= Date.now()) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a key from cache.
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.insertionCounter = 0;
  }

  /**
   * Get cache statistics.
   */
  stats(): CacheStats {
    // Prune expired entries for accurate size
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expires <= now) {
        this.store.delete(key);
      }
    }
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.store.size,
      maxSize: this.maxEntries,
    };
  }
}

/** Singleton instance shared across the API server */
export const globalCache = new MemoryCache();
