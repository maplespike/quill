// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { getHealthMonitor } from '@maplespike/pipeline-core/health-monitoring';

export const definition: ToolDefinition = {
  name: 'get_pipeline_health',
  description:
    'Get a high-level health summary of the entire MapleSpike ingestion pipeline. ' +
    'Returns system status (healthy/degraded/unhealthy), total module counts, ' +
    'and a list of all modules with their current health status. ' +
    'Use this to identify systemic failures or multiple failing data sources.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const handler: ToolHandler = async () => {
  try {
    const monitor = getHealthMonitor();
    const health = await monitor.getSystemHealth();

    return {
      content: {
        tool: 'get_pipeline_health',
        ...health,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_pipeline_health',
        status: 'error',
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};
