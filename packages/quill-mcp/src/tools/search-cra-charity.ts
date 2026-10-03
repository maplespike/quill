import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_cra_charity',
  description:
    'Search CRA (Canada Revenue Agency) registered charity T3010 data. ' +
    'Covers detailed financials, directors, programs, and political activities ' +
    'for charities with a published T3010 return. Charities exempt from filing, ' +
    'or below the filing threshold, will not appear.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — charity name, BN/registration number, or keyword (e.g., "United Way", "climate justice", "registered charity")',
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
        tool: 'search_cra_charity',
        query: '',
        error: 'No search query provided. Try a charity name, registration number, or keyword.',
      },
      isError: true,
    };
  }

  try {
    const result = await searchCkan(query, limit);
    return {
      content: {
        tool: 'search_cra_charity',
        query,
        limit,
        ...result,
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_cra_charity',
        query,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
};
