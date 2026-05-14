/**
 * Tribunals MCP Tool — MapleSpike
 *
 * Stub: returns mock data until the real pipeline is wired.
 */

import type { ToolDefinition, ToolHandler } from './types.js';

export const definition: ToolDefinition = {
  name: 'search_tribunals',
  description: 'Search federal tribunal decisions (Canada) — Alpha',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Max results (default 10)', default: 10 },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Number(args.limit ?? 10);

  return {
    content: {
      tool: 'search_tribunals',
      query,
      limit,
      results: [],
      totalCount: 0,
    },
  };
};
