import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_municipal',
  description:
    'Search Canadian municipal council data — meeting agendas, minutes, decisions, ' +
    'and budgets across major Canadian cities including Toronto, Vancouver, Montreal, Calgary, ' +
    'Ottawa, Edmonton, Winnipeg, Quebec City, and Hamilton.',
  descriptions: {
    'fr-CA': 'Rechercher des données des conseils municipaux canadiens — ordres du jour, procès-verbaux, décisions et budgets des grandes villes canadiennes.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — city name, agenda item, budget topic, or decision type (e.g., "zoning bylaw Toronto", "transit budget Vancouver", "housing policy Montreal")',
      },
      city: {
        type: 'string',
        description: 'Filter by city name',
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
        tool: 'search_municipal',
        query: '',
        error: 'No search query provided. Specify a city, agenda item, or budget topic.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);

  const result = await searchGovData(`municipal council meeting agenda budget ${query}`, 'ontario', limit);

  return {
    content: {
      tool: 'search_municipal',
      query,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
