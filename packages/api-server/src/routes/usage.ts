/**
 * MapleSpike — Usage Endpoint
 *
 * GET /v1/usage — Current period consumption with per-key breakdown
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { TIER_LIMITS } from '../types.js';
import { getRateLimitStatus, getQuotaResetTime } from '../rate-limit.js';

export const usageHandler: RouteHandler = async (_request, ctx) => {
  try {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const yearMonth = now.toISOString().slice(0, 7);

    const [dailyUsage, monthlyUsage] = await Promise.all([
      ctx.db.getDailyUsage(ctx.tenant.id, date),
      ctx.db.getMonthlyUsage(ctx.tenant.id, yearMonth),
    ]);

    const limits = TIER_LIMITS[ctx.tenant.tier] || TIER_LIMITS.free;

    // Get per-key usage breakdown
    const keyBreakdown = await ctx.db.getKeyUsageBreakdown(ctx.tenant.id, yearMonth);

    // Get current rate limit status (without consuming a request)
    const rateStatus = ctx.apiKeyId
      ? getRateLimitStatus(ctx.apiKeyId, limits.perMinute, 60 * 1000, undefined as any)
      : { remaining: limits.perMinute, limit: limits.perMinute, resetTime: Date.now() + 60 * 1000 };

    return jsonResponse(buildSuccess({
      tenant: {
        id: ctx.tenant.id,
        name: ctx.tenant.name,
        tier: ctx.tenant.tier,
      },
      period: {
        date,
        yearMonth,
      },
      usage: {
        daily: {
          calls: dailyUsage,
          limit: limits.daily,
          remaining: Math.max(0, limits.daily - dailyUsage),
          percentUsed: Math.round((dailyUsage / limits.daily) * 100),
          resetAt: getQuotaResetTime('daily'),
        },
        monthly: {
          calls: monthlyUsage,
          limit: limits.monthly,
          remaining: Math.max(0, limits.monthly - monthlyUsage),
          percentUsed: Math.round((monthlyUsage / limits.monthly) * 100),
          resetAt: getQuotaResetTime('monthly'),
        },
        rate: {
          perMinute: limits.perMinute,
          remaining: rateStatus.remaining,
          resetAt: new Date(rateStatus.resetTime).toISOString(),
        },
      },
      keys: keyBreakdown.map((k) => ({
        id: k.keyId,
        name: k.keyName,
        monthlyCalls: k.monthlyCalls,
        dailyCalls: k.dailyCalls,
        monthlyPercentUsed: Math.round((k.monthlyCalls / limits.monthly) * 100),
      })),
      resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Usage lookup failed';
    return jsonResponse(buildError('USAGE_QUERY_FAILED', message, ctx), 500);
  }
};
