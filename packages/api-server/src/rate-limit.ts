/**
 * Quill — Rate Limiting
 *
 * In-memory sliding window rate limiter using Map.
 * Replaces Cloudflare KV-based rate limiting for dev mode.
 */

import type { QuillStorage, Tier } from './types.js';

interface WindowEntry {
  count: number;
  windowStart: number;
}

const rateStore = new Map<string, WindowEntry[]>();

/** Per-minute burst limits per tier. These are intentionally smaller than the
 * daily/monthly quotas to prevent traffic spikes from exhausting a tenant's
 * budget in seconds. */
export const BURST_LIMITS: Record<Tier, number> = {
  free: 10,
  pro: 60,
  business: 120,
  enterprise: 500,
  internal: 1000,
};

/**
 * Check rate limit for a tenant using a sliding window.
 *
 * @param tenantId - The tenant identifier
 * @param limit - Maximum requests allowed in the window
 * @param windowMs - Window duration in milliseconds
 * @returns Whether the request is allowed, remaining budget, and reset timestamp (ms)
 */
export function checkRateLimit(
  tenantId: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();

  if (!rateStore.has(tenantId)) {
    rateStore.set(tenantId, []);
  }

  const entries = rateStore.get(tenantId)!;
  const cutoff = now - windowMs;

  // Prune expired windows
  const active = entries.filter((e) => e.windowStart > cutoff);

  // Aggregate into time buckets (1-second resolution) to prevent memory bloat
  const bucketSizeMs = 1000;
  const buckets = new Map<number, number>();
  for (const e of active) {
    const bucket = Math.floor(e.windowStart / bucketSizeMs) * bucketSizeMs;
    buckets.set(bucket, (buckets.get(bucket) || 0) + e.count);
  }

  const total = Array.from(buckets.values()).reduce((sum, c) => sum + c, 0);

  if (total >= limit) {
    const oldest =
      active.length > 0
        ? active.reduce((min, e) => Math.min(min, e.windowStart), Infinity)
        : now;
    return { allowed: false, remaining: 0, resetTime: oldest + windowMs };
  }

  // Record this request in its bucket
  const currentBucket = Math.floor(now / bucketSizeMs) * bucketSizeMs;
  buckets.set(currentBucket, (buckets.get(currentBucket) || 0) + 1);

  // Rebuild active entries from buckets (deduplicated)
  const rebuilt: WindowEntry[] = [];
  for (const [bucketStart, count] of buckets) {
    rebuilt.push({ count, windowStart: bucketStart });
  }
  rateStore.set(tenantId, rebuilt);

  const oldest =
    rebuilt.length > 0
      ? rebuilt.reduce((min, e) => Math.min(min, e.windowStart), now)
      : now;

  return {
    allowed: true,
    remaining: limit - total - 1,
    resetTime: oldest + windowMs,
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  reason?: 'burst' | 'daily' | 'monthly';
}

/**
 * Enforce both per-minute burst limits and storage-backed daily/monthly quotas.
 * This is the production rate-limiting entry point used by the API gateway.
 *
 * @param db - Storage backend for daily/monthly counters
 * @param tenantId - Authenticated tenant id (or anonymous bucket key)
 * @param tier - Tenant tier (ignored for anonymous traffic)
 * @param isAuthenticated - Whether the request carried a valid credential
 * @param rateLimitKey - In-memory key for burst tracking (tenant id or IP-derived)
 */
export async function enforceRateLimit(
  db: QuillStorage,
  tenantId: string,
  tier: Tier,
  isAuthenticated: boolean,
  rateLimitKey: string,
  options?: { meterQuota?: boolean },
): Promise<RateLimitResult> {
  const windowMs = 60 * 1000;
  // Anonymous burst: 30 req/min — generous enough for portal browsing
  // (page loads trigger ~5 API calls) while still mitigating abuse.
  // Authenticated free tier gets 10/min (direct API calls, not page loads).
  const burstMax = isAuthenticated ? BURST_LIMITS[tier] : 30;

  // 1. In-memory per-minute burst check
  const burstCheck = checkRateLimit(rateLimitKey, burstMax, windowMs);
  if (!burstCheck.allowed) {
    return { ...burstCheck, reason: 'burst' };
  }

  // Anonymous traffic only gets burst protection; no daily/monthly quota tracking.
  // Parliamentary paths pass meterQuota:false so a paid-plan counter neither
  // blocks them nor records the call. The per-minute burst check still runs.
  if (!isAuthenticated || options?.meterQuota === false) {
    return { ...burstCheck, reason: undefined };
  }

  // 2. Storage-backed daily/monthly checks
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const yearMonth = date.substring(0, 7);

  const [dailyUsage, monthlyUsage] = await Promise.all([
    db.getDailyUsage(tenantId, date),
    db.getMonthlyUsage(tenantId, yearMonth),
  ]);

  const { TIER_LIMITS } = await import('./types.js');
  const limits = TIER_LIMITS[tier];

  if (dailyUsage >= limits.daily) {
    const eod = new Date(now);
    eod.setUTCHours(23, 59, 59, 999);
    return { allowed: false, remaining: 0, resetTime: eod.getTime(), reason: 'daily' };
  }

  if (monthlyUsage >= limits.monthly) {
    const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { allowed: false, remaining: 0, resetTime: eom.getTime(), reason: 'monthly' };
  }

  // 3. Increment counters now that the request is allowed
  await db.incrementUsage(tenantId, date, yearMonth);

  // Report the most restrictive remaining budget
  const remainingBudget = Math.min(burstCheck.remaining, limits.daily - dailyUsage - 1);

  return {
    allowed: true,
    remaining: Math.max(0, remainingBudget),
    resetTime: burstCheck.resetTime,
    reason: undefined,
  };
}
