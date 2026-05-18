import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_veterans',
  description:
    'Search Canadian veterans and military personnel data — VAC (Veterans Affairs Canada) ' +
    'benefits, disability claims, education programs, OSISS clinics, veteran suicide statistics, ' +
    'defence transition programs, and wait times data.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search term (e.g., "disability", "education", "benefits", "wait times")',
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
        tool: 'search_veterans',
        query: '',
        error: 'No search query provided. Please specify search terms (e.g., "disability", "benefits").',
      },
      isError: true,
    };
  }

  try {
    const result = await searchGovData(query, 'all', limit);
    return {
      content: {
        tool: 'search_veterans',
        query,
        limit,
        ...result,
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_veterans',
        query,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
};
