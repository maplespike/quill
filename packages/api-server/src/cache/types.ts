// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Cache Backend Types
 *
 * Unified interface for all cache backends. Every backend
 * (memory, Redis, etc.) implements this contract so consumers
 * are decoupled from the storage engine.
 */

export interface CacheBackend {
  /**
   * Retrieve a value by key. Returns null on miss.
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Store a value with optional TTL (seconds).
   * Omit ttlSeconds or pass 0 for indefinite persistence.
   */
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;

  /**
   * Remove a key from the cache.
   */
  invalidate(key: string): Promise<void>;

  /**
   * Optional: check whether the backend is currently connected.
   * Always true for memory backends.
   */
  isConnected?(): boolean;
}
