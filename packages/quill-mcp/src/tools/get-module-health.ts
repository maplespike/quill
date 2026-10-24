// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { getHealthMonitor } from '@maplespike/pipeline-core/health-monitoring';

export const definition: ToolDefinition = {
  name: 'get_module_health',
  description:
    'Get detailed health metrics for a specific ingestion module. ' +
    'Returns status (healthy/degraded/unhealthy), upstream reachability, ' +
    'success rate, consecutive failures, and last error message. ' +
    'Use this to diagnose why a specific data source is failing.',
  inputSchema: {
    type: 'object',
    properties: {
      moduleName: {
        type: 'string',
        maxLength: 500,
description: 'Name of the module (e.g., "committees", "rss", "gov-api")',
      },
    },
    required: ['moduleName'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  try {
    const moduleName = String(args.moduleName ?? '');
    const monitor = getHealthMonitor();
    const health = await monitor.getModuleHealthWithUpstream(moduleName);

    return {
      content: {
        tool: 'get_module_health',
        ...health,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_module_health',
        status: 'error',
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};
