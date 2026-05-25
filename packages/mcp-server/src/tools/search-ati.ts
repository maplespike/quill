import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_ati',
  description:
    'Search completed Access to Information (ATI) requests published by federal departments. ' +
    'Covers ATI summaries from all government departments and agencies. ' +
    'Useful for finding previously released records, internal reports, and correspondence.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — keyword, department, or subject (e.g., "climate change", "procurement", "PCO")',
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
    return {
      content: {
        tool: 'search_ati',
        query: '',
        error: 'No search query provided. Try a keyword, department, or subject.',
      },
      isError: true,
    };
  }

  try {
    const result = await searchGovData(query, 'all', limit);
    return {
      content: {
        tool: 'search_ati',
        query,
        limit,
        ...result,
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_ati',
        query,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
};
