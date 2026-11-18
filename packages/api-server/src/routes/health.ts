// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — GET /v1/health
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, UNKNOWN_SOURCE_CITATION } from '../response.js';
import { loadConfig } from '../config.js';

interface DependencyStatus {
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs: number;
  error?: string;
}

async function checkDependency(
  name: string,
  checkFn: () => Promise<void>,
  timeoutMs = 2000,
): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    await Promise.race([
      checkFn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs),
      ),
    ]);
    return { name, status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { name, status: 'down', latencyMs, error: message };
  }
}

export const healthHandler: RouteHandler = async (_request, ctx) => {
  try {
    const config = loadConfig(ctx.env);
    const [dailyUsage, monthlyUsage, dependencies] = await Promise.all([
      ctx.db.getDailyUsage(ctx.tenant.id, new Date().toISOString().slice(0, 10)),
      ctx.db.getMonthlyUsage(ctx.tenant.id, new Date().toISOString().slice(0, 7)),
      Promise.all([
        checkDependency('api-server', async () => {}),
        checkDependency('storage', async () => {
          await ctx.db.getDailyUsage('_health_', '1970-01-01');
        }),
        checkDependency('cache', async () => {
          await ctx.cache.get('health:ping');
          await ctx.cache.put('health:ping', 'ok', 1);
        }),
      ]),
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
      dependencies,
      timestamp: new Date().toISOString(),
    };

    // Health-check time is in `data.timestamp`, not source retrieval metadata.
    return jsonResponse(buildSuccess(body, ctx, UNKNOWN_SOURCE_CITATION));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse(buildError('HEALTH_CHECK_FAILED', message, ctx), 500);
  }
};
