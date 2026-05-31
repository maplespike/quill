/**
 * MapleSpike — Usage Tracking & Quota Enforcement
 *
 * Tracks API requests per tenant and enforces tier-based quotas.
 * Uses in-memory sliding window counters (replace with DB for production).
 */
import type { Tenant } from './types.js';

const TIER_LIMITS: Record<string, { requestsPerMonth: number; requestsPerSec: number }> = {
  free: { requestsPerMonth: 1_000, requestsPerSec: 2 },
  pro: { requestsPerMonth: 100_000, requestsPerSec: 25 },
  business: { requestsPerMonth: 500_000, requestsPerSec: 100 },
  internal: { requestsPerMonth: Infinity, requestsPerSec: 1000 },
};

const monthCounters = new Map<string, { count: number; month: string }>();
const secCounters = new Map<string, { count: number; windowStart: number }>();

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function checkQuota(tenant: Tenant): { allowed: boolean; remaining: number; resetTime: string } {
  const limits = TIER_LIMITS[tenant.tier] || TIER_LIMITS.free;
  const month = currentMonth();

  // Monthly counter
  const mKey = `month:${tenant.id}`;
  let mEntry = monthCounters.get(mKey);
  if (!mEntry || mEntry.month !== month) {
    mEntry = { count: 0, month };
    monthCounters.set(mKey, mEntry);
  }

  // Second window counter
  const sKey = `sec:${tenant.id}`;
  const now = Date.now();
  let sEntry = secCounters.get(sKey);
  if (!sEntry || now - sEntry.windowStart > 1000) {
    sEntry = { count: 0, windowStart: now };
    secCounters.set(sKey, sEntry);
  }

  const monthRemaining = Math.max(0, limits.requestsPerMonth - mEntry.count);
  const allowed = mEntry.count < limits.requestsPerMonth && sEntry.count < limits.requestsPerSec;

  mEntry.count++;
  sEntry.count++;

  return {
    allowed,
    remaining: monthRemaining - 1,
    resetTime: new Date(now + 86400000).toISOString(),
  };
}

export function getUsage(tenantId: string): { month: string; count: number } {
  const mKey = `month:${tenantId}`;
  const entry = monthCounters.get(mKey);
  return { month: entry?.month || currentMonth(), count: entry?.count || 0 };
}
