export interface WindowEntry {
  count: number;
  windowStart: number;
}

export function checkRateLimit(
  entries: WindowEntry[],
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  const active = entries.filter(e => e.windowStart > cutoff);
  const total = active.reduce((sum, e) => sum + e.count, 0);

  if (total >= limit) {
    const oldest = active.length > 0
      ? active.reduce((min, e) => Math.min(min, e.windowStart), Infinity)
      : now;
    return { allowed: false, remaining: 0, resetTime: oldest + windowMs };
  }

  active.push({ count: 1, windowStart: now });

  const oldest = active.length > 0
    ? active.reduce((min, e) => Math.min(min, e.windowStart), now)
    : now;

  return {
    allowed: true,
    remaining: limit - total - 1,
    resetTime: oldest + windowMs,
  };
}
