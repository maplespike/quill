// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_uk_ons',
  description:
    'Search UK Office for National Statistics data — CPI, GDP, labour force, population, trade, and housing via time series API.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — keyword, location, or category (e.g., relevant search terms for this dataset)',
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
    return { content: { tool: 'search_uk_ons', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(query + ' UK ONS statistics', limit);
    return { content: { tool: 'search_uk_ons', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_uk_ons', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
