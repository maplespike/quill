import type { ToolDefinition, ToolHandler } from './types.js';
import * as api from './api-client.js';

export const definition: ToolDefinition = {
  name: 'system_health',
  description:
    'Check the MapleSpike API service health. Returns service status, ' +
    'version, tenant tier, and current API call usage (daily/monthly). ' +
    'Use this to verify the API is responding and to check your quota.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const handler: ToolHandler = async () => {
  try {
    const health = await api.getHealth();
    const usage = await api.getUsage();

    return {
      content: {
        tool: 'system_health',
        status: health.status,
        service: health.service,
        version: health.version,
        tier: health.tenant.tier,
        usage: {
          daily: health.usage.daily,
          monthly: health.usage.monthly,
          periodCalls: usage.periodCalls,
          periodLimit: usage.periodLimit,
        },
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
