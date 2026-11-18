// SPDX-License-Identifier: AGPL-3.0-only
interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  oldestMs: number;
  newestMs: number;
}

const store = new Map<string, CacheEntry>();
let hits = 0;
let misses = 0;

const DEFAULT_TTL_MS = 60_000;

export function cacheGet<T = unknown>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) {
    misses++;
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    misses++;
    return null;
  }
  hits++;
  return entry.data as T;
}

export function cacheSet(key: string, data: unknown, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function cacheClear(): void {
  store.clear();
  hits = 0;
  misses = 0;
}

export function cacheStats(): CacheStats {
  const now = Date.now();
  let oldestMs = now;
  let newestMs = 0;
  let activeCount = 0;

  for (const entry of store.values()) {
    if (now <= entry.expiresAt) {
      activeCount++;
      const age = entry.expiresAt - now;
      if (age > newestMs) newestMs = age;
      if (age < oldestMs) oldestMs = age;
    }
  }

  const total = hits + misses;
  return {
    size: activeCount,
    hits,
    misses,
    hitRate: total > 0 ? hits / total : 0,
    oldestMs: oldestMs === now ? 0 : oldestMs,
    newestMs,
  };
}

export function cacheKey(toolName: string, params: Record<string, unknown>): string {
  return `${toolName}:${JSON.stringify(params, Object.keys(params).sort())}`;
}
