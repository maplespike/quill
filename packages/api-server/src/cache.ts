/**
 * MapleSpike — In-Memory Cache
 *
 * Simple TTL-based cache with hit/miss tracking for cacheStatus reporting.
 * Can be upgraded to Redis later.
 */

interface CacheEntry {
  value: unknown;
  expires: number; // epoch ms, Infinity for no expiry
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

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
   * Store a value with optional TTL in seconds.
   */
  set(key: string, value: unknown, ttlSeconds?: number): void {
    const expires = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity;
    this.store.set(key, { value, expires });
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
      size: this.store.size,
    };
  }
}

/** Singleton instance shared across the API server */
export const globalCache = new MemoryCache();
