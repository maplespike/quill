import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_cra_charity',
  description:
    'Search CRA registered charity data — charity financial filings, directors, ' +
    'program spending, and compliance records from the Canada Revenue Agency. ' +
    'Tracks charity name, BN/registration number, status, revenue, grants, and ' +
    'compensation data.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search — charity name, BN number, city, or category',
      },
      status: {
        type: 'string',
        enum: ['active', 'revoked', 'all'],
        description: 'Filter by charity registration status',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum results to return (default: 10)',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  if (!query.trim()) {
    return {
      content: {
        tool: 'search_cra_charity',
        query: '',
        error: 'No search query provided. Specify a charity name or BN number.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);
  const result = await searchGovData(query, 'all', limit);
  let results = result.results;

  const status = (args.status as string) ?? '';
  if (status && status !== 'all') {
    const s = status.toLowerCase();
    results = results.filter((r: any) =>
      JSON.stringify(r).toLowerCase().includes(s)
    );
  }

  return {
    content: {
      tool: 'search_cra_charity',
      query,
      status: status || undefined,
      limit,
      results,
      totalCount: status && status !== 'all' ? results.length : result.total,
    },
  };
};
