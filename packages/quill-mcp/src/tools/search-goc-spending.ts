import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_goc_spending',
  description:
    'Search Government of Canada spending data — federal contract awards, ' +
    'grant contributions, and expenditure information from the departments and programs ' +
    'present in the federal spending datasets this tool reaches. ' +
    'Covers GitHub-based federal spending datasets, whose coverage is set by those publishers.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — vendor, department, or program (e.g., "Amazon Web Services", "PSPC", "innovation grants")',
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
        tool: 'search_goc_spending',
        query: '',
        error: 'No search query provided. Try a vendor name, department, or program.',
      },
      isError: true,
    };
  }

  try {
    const result = await searchCkan(query, limit);
    return {
      content: {
        tool: 'search_goc_spending',
        query,
        limit,
        ...result,
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_goc_spending',
        query,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
};
