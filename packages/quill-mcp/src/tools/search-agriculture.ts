// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_agriculture',
  description:
    'Search Agriculture and Agri-Food Canada (AAFC) data — crop reports, farm data, ' +
    'agri-stats, and agricultural production information by province and commodity.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — commodity, province, or metric (e.g., "wheat Saskatchewan", "dairy production", "farm income")',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 20)',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Number(args.limit ?? 20);
  if (!query.trim()) {
    return { content: { tool: 'search_agriculture', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_agriculture', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_agriculture', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
