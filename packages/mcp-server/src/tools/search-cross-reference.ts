import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_cross_reference',
  description:
    'Search Cross-Reference engine — links entities across committees, corporate, lobbying, and influence modules.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
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
    return { content: { tool: 'search_cross_reference', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(query + ' cross reference entity', limit);
    return { content: { tool: 'search_cross_reference', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_cross_reference', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
