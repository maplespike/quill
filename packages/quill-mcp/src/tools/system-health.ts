import type { ToolDefinition, ToolHandler } from './types.js';
import * as api from './api-client.js';
import { searchCkan } from './upstream-fetcher.js';
import { cacheStats } from '../optimization/cache.js';
import { getQuotaTracker, getCurrentIdentity } from '../quota.js';

export const definition: ToolDefinition = {
  name: 'system_health',
  description:
    'Check the MapleSpike API service health. Returns service status, ' +
    'version, environment, tenant tier, current API call usage (daily/monthly), ' +
    'local free-tier quota (1,000 calls/month per identity, then x402 charged per call), ' +
    'per-dependency health checks (API server, storage, cache) with response times, ' +
    'and query optimization statistics (cache hit rate, result limits). ' +
    'Use this to verify the API is responding and to check your quota.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const handler: ToolHandler = async () => {
  try {
    const health = await api.getHealth();
    let usageTier: string | undefined;
    let usageDaily: { calls: number; limit: number } | undefined;
    let usageMonthly: { calls: number; limit: number } | undefined;
    let usagePeriodCalls: number | undefined;
    let usagePeriodLimit: number | undefined;
    try {
      const u = await api.getUsage();
      usageTier = u.tenant?.tier;
      usageDaily = u.usage?.daily;
      usageMonthly = u.usage?.monthly;
      usagePeriodCalls = u.usage?.monthly?.calls;
      usagePeriodLimit = u.usage?.monthly?.limit;
    } catch {
      // /usage may be unreachable or rate-limited; leave undefined so callers
      // can detect the fallback rather than trusting fabricated numbers.
    }
    const optStats = cacheStats();

    // Surface the local freemium quota when an identity is bound. stdio
    // callers (`self-hosted`) see `enabled:false` and an explanatory note.
    const currentIdentity = getCurrentIdentity();
    const localQuota = currentIdentity
      ? (getQuotaTracker().getStatus(currentIdentity) as unknown as Record<string, unknown>)
      : {
          enabled: false,
          note: 'no identity bound — quota status unavailable',
        };

    return {
      content: {
        tool: 'system_health',
        status: health.status,
        service: health.service,
        version: health.version,
        environment: health.environment,
        tier: usageTier || health.tenant.tier,
        usage: {
          daily: usageDaily || health.usage.daily,
          monthly: usageMonthly || health.usage.monthly,
          periodCalls: usagePeriodCalls,
          periodLimit: usagePeriodLimit,
        },
        localQuota,
        optimization: {
          cacheSize: optStats.size,
          cacheHits: optStats.hits,
          cacheMisses: optStats.misses,
          cacheHitRate: Math.round(optStats.hitRate * 100),
          maxResultsLimit: 200,
          absoluteMax: 1000,
        },
        dependencies: health.dependencies,
        timestamp: health.timestamp,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'system_health',
        status: 'error',
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};
