// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { cacheStats } from '../optimization/cache.js';

export const definition: ToolDefinition = {
  name: 'cache_status',
  description:
    'Query optimization cache status. Returns cache hit/miss rates, ' +
    'current cache size, and TTL range. Use system_health for full optimization stats.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const handler: ToolHandler = async () => {
  const stats = cacheStats();
  return {
    content: {
      tool: 'cache_status',
      size: stats.size,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: Math.round(stats.hitRate * 100),
      ttlRangeMs: { min: stats.oldestMs, max: stats.newestMs },
    },
  };
};
