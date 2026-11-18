// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_fisheries',
  description:
    'Search Fisheries and Oceans Canada (DFO) data — fish stocks, licenses, ' +
    'conservation measures, and marine management information.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — species, region, or license type (e.g., "Atlantic cod", "Pacific salmon", "aquaculture BC")',
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
    return { content: { tool: 'search_fisheries', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_fisheries', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_fisheries', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
