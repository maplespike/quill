/**
 * MapleSpike — Rate Limiting & Quota Enforcement
 *
 * Sliding window rate limiter supporting per-tenant and per-key limits.
 * Tracks request counts in memory with configurable windows.
 */

import type { KeyRateLimit } from './types.js';

interface WindowEntry {
  timestamp: number;
  count: number;
}

const tenantStore = new Map<string, WindowEntry[]>();
const keyStore = new Map<string, WindowEntry[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetTime: number;
}

/**
 * Check rate limit for a tenant using a sliding window.
 *
 * @param tenantId - The tenant identifier
 * @param limit - Maximum requests allowed in the window
 * @param windowMs - Window duration in milliseconds
 * @returns Rate limit check result
 */
export function checkRateLimit(
  tenantId: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  return checkSlidingWindow(tenantStore, tenantId, limit, windowMs);
}

/**
 * Check rate limit for a specific API key using a sliding window.
 * Falls back to tenant-level check if no key-specific limit is set.
 *
 * @param apiKeyId - The API key identifier
 * @param limit - Maximum requests allowed in the window
 * @param windowMs - Window duration in milliseconds
 * @returns Rate limit check result
 */
export function checkKeyRateLimit(
  apiKeyId: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  return checkSlidingWindow(keyStore, apiKeyId, limit, windowMs);
}

/**
 * Generic sliding window rate limiter.
 */
function checkSlidingWindow(
  store: Map<string, WindowEntry[]>,
  identifier: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  if (!store.has(identifier)) {
    store.set(identifier, []);
  }

  const entries = store.get(identifier)!;
  const cutoff = now - windowMs;

  // Prune expired windows
  const active = entries.filter((e) => e.timestamp > cutoff);

  const total = active.reduce((sum, e) => sum + e.count, 0);

  if (total >= limit) {
    const oldest =
      active.length > 0
        ? active.reduce((min, e) => Math.min(min, e.timestamp), Infinity)
        : now;
    return { allowed: false, remaining: 0, limit, resetTime: oldest + windowMs };
  }

  // Record this request
  active.push({ count: 1, timestamp: now });
  store.set(identifier, active);

  const oldest =
    active.length > 0
      ? active.reduce((min, e) => Math.min(min, e.timestamp), now)
      : now;

  return {
    allowed: true,
    remaining: limit - total - 1,
    limit,
    resetTime: oldest + windowMs,
  };
}

/**
 * Reset rate limit counters for a tenant (e.g., after tier upgrade).
 */
export function resetTenantRateLimit(tenantId: string): void {
  tenantStore.delete(tenantId);
}

/**
 * Reset rate limit counters for a specific API key.
 */
export function resetKeyRateLimit(apiKeyId: string): void {
  keyStore.delete(apiKeyId);
}

/**
 * Get current rate limit status without consuming a request.
 */
export function getRateLimitStatus(
  identifier: string,
  limit: number,
  windowMs: number,
  store: Map<string, WindowEntry[]> = tenantStore,
): { remaining: number; limit: number; resetTime: number } {
  const now = Date.now();
  const entries = store.get(identifier) || [];
  const cutoff = now - windowMs;
  const active = entries.filter((e) => e.timestamp > cutoff);
  const total = active.reduce((sum, e) => sum + e.count, 0);

  const oldest =
    active.length > 0
      ? active.reduce((min, e) => Math.min(min, e.timestamp), now)
      : now;

  return {
    remaining: Math.max(0, limit - total),
    limit,
    resetTime: oldest + windowMs,
  };
}

/**
 * Calculate quota reset time based on period.
 */
export function getQuotaResetTime(period: 'daily' | 'monthly'): string {
  const now = new Date();
  if (period === 'daily') {
    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    return reset.toISOString();
  }
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return reset.toISOString();
}
