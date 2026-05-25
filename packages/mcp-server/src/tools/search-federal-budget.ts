import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_federal_budget',
  description:
    'Search Canadian federal budget data — budget documents, fiscal projections, ' +
    'departmental spending plans, tax measures, and economic statements from the ' +
    'Department of Finance and Treasury Board.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — department, program, fiscal year, or measure',
      },
      budgetYear: {
        type: 'string',
        description: 'Filter by budget year (e.g., "2024", "2025")',
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
        tool: 'search_federal_budget',
        query: '',
        error: 'No search query provided. Specify a department, program, or fiscal measure.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);
  const result = await searchGovData(query, 'all', limit);
  let results = result.results;

  const budgetYear = (args.budgetYear as string) ?? '';
  if (budgetYear) {
    const by = budgetYear.toLowerCase();
    results = results.filter((r: any) =>
      JSON.stringify(r).toLowerCase().includes(by)
    );
  }

  return {
    content: {
      tool: 'search_federal_budget',
      query,
      budgetYear: budgetYear || undefined,
      limit,
      results,
      totalCount: budgetYear ? results.length : result.total,
    },
  };
};
