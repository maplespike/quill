// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Memory Cache Backend
 *
 * In-memory TTL map with cache-aside pattern support.
 * Default backend when Redis is not configured or unavailable.
 * No external dependencies required — always connected.
 */

import type { CacheBackend } from './types.js';

interface Entry {
  value: unknown;
  expiresAt: number; // epoch ms; Infinity for no expiry
}

export class MemoryBackend implements CacheBackend {
  private store = new Map<string, Entry>();
  private hits = 0;
  private misses = 0;

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds && ttlSeconds > 0
      ? Date.now() + ttlSeconds * 1000
      : Infinity;
    this.store.set(key, { value, expiresAt });
  }

  async invalidate(key: string): Promise<void> {
    this.store.delete(key);
  }

  /** Always true — memory backend has no connection state. */
  isConnected(): boolean {
    return true;
  }

  /** Remove all entries and reset stats. */
  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /** Prune expired entries and return current stats. */
  stats(): { hits: number; misses: number; size: number } {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
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
