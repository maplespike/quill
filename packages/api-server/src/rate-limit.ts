/**
 * Quill — Rate Limiting
 *
 * In-memory sliding window rate limiter using Map.
 * Replaces Cloudflare KV-based rate limiting for dev mode.
 */

interface WindowEntry {
  count: number;
  windowStart: number;
}

const rateStore = new Map<string, WindowEntry[]>();

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
