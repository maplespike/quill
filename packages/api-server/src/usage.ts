// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Usage Tracking & Quota Enforcement
 *
 * Tracks API requests per tenant and enforces tier-based quotas.
 * Uses in-memory sliding window counters (replace with DB for production).
 *
 * Canonical tier limits sourced from types.ts TIER_LIMITS.
 * Internal tier bypasses all quotas.
 */
import type { Tenant } from './types.js';
import { TIER_LIMITS } from './types.js';

const monthCounters = new Map<string, { count: number; month: string }>();

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function checkQuota(tenant: Tenant): { allowed: boolean; remaining: number; resetTime: string } {
  // Internal tier bypasses all quotas
  if (tenant.tier === 'internal') {
    return { allowed: true, remaining: Infinity, resetTime: new Date(Date.now() + 86400000).toISOString() };
  }

  const limits = TIER_LIMITS[tenant.tier] || TIER_LIMITS.free;
  const month = currentMonth();

  // Monthly counter
  const mKey = `month:${tenant.id}`;
  let mEntry = monthCounters.get(mKey);
  if (!mEntry || mEntry.month !== month) {
    mEntry = { count: 0, month };
    monthCounters.set(mKey, mEntry);
  }

  // Hard cap: monthly limit from canonical TIER_LIMITS
  const monthRemaining = Math.max(0, limits.monthly - mEntry.count);
  const allowed = mEntry.count < limits.monthly;

  mEntry.count++;

  return {
    allowed,
    remaining: monthRemaining - 1,
    resetTime: new Date(Date.now() + 86400000).toISOString(),
  };
}

export function getUsage(tenantId: string): { month: string; count: number } {
  const mKey = `month:${tenantId}`;
  const entry = monthCounters.get(mKey);
  return { month: entry?.month || currentMonth(), count: entry?.count || 0 };
}
