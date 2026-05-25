import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_goc_spending',
  description:
    'Search Government of Canada spending and procurement data — contract awards, ' +
    'grant contributions, departmental expenditures, CanadaBuys tender notices, ' +
    'and proactive disclosure of contracts over $10K. Tracks vendor, department, ' +
    'value, and competitive vs. sole-source awards.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — vendor name, department, or contract keyword',
      },
      spendingType: {
        type: 'string',
        enum: ['contracts', 'grants', 'all'],
        description: 'Filter by spending type',
      },
      minValue: {
        type: 'number',
        description: 'Minimum contract value in CAD',
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
        tool: 'search_goc_spending',
        query: '',
        error: 'No search query provided. Specify a vendor, department, or contract keyword.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);
  const result = await searchGovData(query, 'all', limit);
  let results = result.results;

  const spendingType = (args.spendingType as string) ?? '';
  if (spendingType && spendingType !== 'all') {
    const st = spendingType.toLowerCase();
    results = results.filter((r: any) =>
      JSON.stringify(r).toLowerCase().includes(st)
    );
  }

  const minValue = (args.minValue as number) ?? 0;
  if (minValue > 0) {
    results = results.filter((r: any) => {
      const val = r.value || r.contract_value || r.amount || 0;
      return Number(val) >= minValue;
    });
  }

  return {
    content: {
      tool: 'search_goc_spending',
      query,
      spendingType: spendingType || undefined,
      minValue: minValue || undefined,
      limit,
      results,
      totalCount: result.total,
    },
  };
};
