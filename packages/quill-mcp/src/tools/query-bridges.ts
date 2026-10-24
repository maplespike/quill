// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchBridgeConditions } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'query_bridges',
  description: 'Query bridge infrastructure conditions across Canadian provinces. Uses Statistics Canada Core Public Infrastructure data. Returns condition ratings (very good, good, fair, poor, very poor) with percentages. Compare infrastructure quality between provinces.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 500, description: 'Province or condition filter (e.g., "Ontario", "good", "poor")' },
      limit: { type: 'number', minimum: 1, maximum: 100, description: 'Max results (default: 20)' },
    },
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Math.min((args.limit as number) ?? 20, 100);
  try {
    const { results, total } = await fetchBridgeConditions(query, limit);
    return { content: { tool: 'query_bridges', query: query || undefined, limit, results, totalCount: total } };
  } catch (error) {
    return { content: { tool: 'query_bridges', status: 'error', error: (error instanceof Error && error.message) || String(error) }, isError: true };
  }
};
