import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_charity_t3010',
  description:
    'Search CRA T3010 Registered Charity Information Return data. ' +
    'Covers detailed financial statements, director compensation, political activities, ' +
    'program spending, and revenue breakdowns for charities that have filed a T3010 return — ' +
    'charities exempt from filing, or below the filing threshold, will not appear. ' +
    'More focused on T3010 returns than the general charity search.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — charity name, BN, or category (e.g., "Salvation Army", "environment", "religious")',
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
    return { content: { tool: 'search_charity_t3010', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(`charity t3010 ${query}`, limit);
    return { content: { tool: 'search_charity_t3010', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_charity_t3010', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
