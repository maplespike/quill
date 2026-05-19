import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_agriculture',
  description:
    'Search Agriculture and Agri-Food Canada (AAFC) data — crop reports, farm income statistics, ' +
    'agricultural trade data, soil health, and agri-science research. ' +
    'Covers national and provincial agricultural data from AAFC and StatCan.',
  descriptions: {
    'fr-CA': 'Rechercher des données d\'Agriculture et Agroalimentaire Canada — rapports sur les cultures, statistiques de revenu agricole, données commerciales agricoles, santé des sols et recherche agroscientifique.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — crop type, province, farm program, or agricultural topic (e.g., "canola production Saskatchewan", "dairy supply management", "farm income support")',
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
        tool: 'search_agriculture',
        query: '',
        error: 'No search query provided. Specify a crop, province, or agricultural program.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);

  const result = await searchGovData(`agriculture crop farm AAFC ${query}`, 'federal', limit);

  return {
    content: {
      tool: 'search_agriculture',
      query,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
