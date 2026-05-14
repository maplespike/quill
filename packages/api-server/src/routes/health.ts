/**
 * MapleSpike — GET /v1/health
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, OGL_C_CITATION } from '../response.js';
import { loadConfig } from '../config.js';

export const healthHandler: RouteHandler = async (_request, ctx) => {
  try {
    const config = loadConfig(ctx.env);
    const [dailyUsage, monthlyUsage] = await Promise.all([
      ctx.db.getDailyUsage(ctx.tenant.id, new Date().toISOString().slice(0, 10)),
      ctx.db.getMonthlyUsage(ctx.tenant.id, new Date().toISOString().slice(0, 7)),
    ]);

    const body = {
      status: 'ok',
      service: config.name,
      version: config.version,
      environment: config.environment,
      tenant: {
        id: ctx.tenant.id,
        name: ctx.tenant.name,
        tier: ctx.tenant.tier,
      },
      usage: {
        daily: dailyUsage,
        monthly: monthlyUsage,
      },
      timestamp: new Date().toISOString(),
    };

    // Build a fresh citation envelope with current timestamp
    const citation = {
      ...OGL_C_CITATION,
      retrieved_at: new Date().toISOString(),
    };

    return jsonResponse(buildSuccess(body, ctx, citation));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse(buildError('HEALTH_CHECK_FAILED', message, ctx), 500);
  }
};
