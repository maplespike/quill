import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_goc_spending',
  description:
    'Search Government of Canada spending data — federal contracts, grants, contributions, ' +
    'and transfer payments. Covers spending by department, vendor, program area, and fiscal year ' +
    'from open government spending datasets.',
  descriptions: {
    'fr-CA': 'Rechercher des données sur les dépenses du gouvernement du Canada — contrats fédéraux, subventions, contributions et paiements de transfert.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — vendor name, department, program, or spending category (e.g., "IT services contract", "research grant NSERC", "infrastructure transfer")',
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
        error: 'No search query provided. Specify a vendor, department, or spending category.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);

  const result = await searchGovData(`spending contract grant contribution ${query}`, 'federal', limit);

  return {
    content: {
      tool: 'search_goc_spending',
      query,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
