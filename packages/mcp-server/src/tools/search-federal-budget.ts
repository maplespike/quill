import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_federal_budget',
  description:
    'Search Canadian federal budget data — budget plans, public accounts, fiscal monitor reports, ' +
    'departmental plans, and results. Covers federal spending, revenue, deficit/surplus, ' +
    'and program expenditure tracking from the Department of Finance and Treasury Board Secretariat.',
  descriptions: {
    'fr-CA': 'Rechercher des données sur le budget fédéral canadien — plans budgétaires, comptes publics, moniteur financier, plans départementaux et résultats.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — program, department, fiscal year, or budget category (e.g., "healthcare transfers 2025", "defence spending", "fiscal deficit")',
      },
      year: {
        type: 'number',
        description: 'Filter by fiscal year',
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
        error: 'No search query provided. Specify a program, department, or fiscal year.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);
  const year = args.year as number | undefined;

  const q = `budget fiscal public accounts expenditure ${query}` + (year ? ` ${year}` : '');
  const result = await searchGovData(q, 'federal', limit);

  return {
    content: {
      tool: 'search_federal_budget',
      query,
      year,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
