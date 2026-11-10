// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Usage Endpoint
 *
 * GET /v1/usage — the calling key's OWN current-period consumption (#891).
 *
 * SELF-SCOPED BY DESIGN. Every authenticated tier may read its own counters,
 * so a customer who just signed up can see their plan, their limits, and what
 * they have spent — instead of a 402 wall that only proves "your key is not
 * 401". This handler reads ctx.tenant.id and nothing else: there is no
 * cross-tenant read path here, so opening it to Free carries no leak risk.
 *
 * Tenant-wide ANALYTICS (aggregate dashboards, cross-tenant reporting) stay
 * behind the `usageAnalytics` gate in feature-gates.ts (Business+). That gate
 * guards reading OTHER tenants' numbers — never your own.
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

    // Keep the envelope's meta.usage truthful. It is the same summary a
    // blocked (402) caller reads, so the two surfaces must not disagree —
    // an always-zero periodCalls would tell a paying customer they are idle.
    ctx.metaOverrides = {
      ...ctx.metaOverrides,
      usage: {
        periodCalls: monthlyUsage,
        periodLimit: limits.monthly,
        tier: ctx.tenant.tier,
      },
    };

    return jsonResponse(buildSuccess({
      scope: 'self',
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
