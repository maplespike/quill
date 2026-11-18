// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { cacheStats, cacheClear } from '../optimization/cache.js';

export const definition: ToolDefinition = {
  name: 'cache_clear',
  description:
    'Clear the query optimization cache. Use when you need fresh data ' +
    'or after data updates. Returns the number of entries cleared.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const handler: ToolHandler = async () => {
  const stats = cacheStats();
  const cleared = stats.size;
  cacheClear();
  return {
    content: {
      tool: 'cache_clear',
      cleared,
      message: `Cleared ${cleared} cached entries`,
    },
  };
};
