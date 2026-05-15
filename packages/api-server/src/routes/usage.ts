/**
 * MapleSpike — Usage Endpoint
 *
 * GET /v1/usage — Current period consumption
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { TIER_LIMITS } from '../types.js';

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
        },
        monthly: {
          calls: monthlyUsage,
          limit: limits.monthly,
          remaining: Math.max(0, limits.monthly - monthlyUsage),
          percentUsed: Math.round((monthlyUsage / limits.monthly) * 100),
        },
      },
      resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Usage lookup failed';
    return jsonResponse(buildError('USAGE_QUERY_FAILED', message, ctx), 500);
  }
};
