/**
 * CivInt Canada — Rate Limiting
 *
 * Per-tier rate limiting using daily/monthly usage counters.
 */

import type { Tenant, CivIntStorage } from './types.js';
import { TIER_LIMITS } from './types.js';

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  dailyCalls: number;
  monthlyCalls: number;
  dailyLimit: number;
  monthlyLimit: number;
}

/**
 * Check rate limits for a tenant.
 * Returns {allowed: false} with reason if over limit.
 */
export async function checkRateLimit(
  tenant: Tenant,
  db: CivIntStorage,
): Promise<RateLimitResult> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const yearMonth = now.toISOString().slice(0, 7); // YYYY-MM

  const limits = TIER_LIMITS[tenant.tier];
  if (!limits) {
    return {
      allowed: false,
      reason: `Unknown tier: ${tenant.tier}`,
      dailyCalls: 0,
      monthlyCalls: 0,
      dailyLimit: 0,
      monthlyLimit: 0,
    };
  }

  const [dailyCalls, monthlyCalls] = await Promise.all([
    db.getDailyUsage(tenant.id, date),
    db.getMonthlyUsage(tenant.id, yearMonth),
  ]);

  // Internal tier gets unlimited access
  if (tenant.tier === 'internal') {
    return { allowed: true, dailyCalls, monthlyCalls, dailyLimit: limits.daily, monthlyLimit: limits.monthly };
  }

  if (dailyCalls >= limits.daily) {
    return {
      allowed: false,
      reason: `Daily limit reached (${dailyCalls}/${limits.daily}). Resets at midnight UTC.`,
      dailyCalls,
      monthlyCalls,
      dailyLimit: limits.daily,
      monthlyLimit: limits.monthly,
    };
  }

  if (monthlyCalls >= limits.monthly) {
    return {
      allowed: false,
      reason: `Monthly limit reached (${monthlyCalls}/${limits.monthly}). Upgrade at civint.ca/pricing.`,
      dailyCalls,
      monthlyCalls,
      dailyLimit: limits.daily,
      monthlyLimit: limits.monthly,
    };
  }

  return { allowed: true, dailyCalls, monthlyCalls, dailyLimit: limits.daily, monthlyLimit: limits.monthly };
}
