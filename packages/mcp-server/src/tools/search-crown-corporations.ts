import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_crown_corporations',
  description:
    'Search Canadian Crown corporation data — annual reports, quarterly financials, ' +
    'governance data, and corporate plans for CBC/Radio-Canada, Canada Post, CMHC, EDC, ' +
    'VIA Rail, BDC, Farm Credit Canada, and other federal Crown corporations.',
  descriptions: {
    'fr-CA': 'Rechercher des données sur les sociétés d\'État canadiennes — rapports annuels, états financiers trimestriels, données de gouvernance et plans corporatifs.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — Crown corp name, financial metric, or governance topic (e.g., "CMHC housing starts", "Canada Post financial results", "CBC annual report")',
      },
      corporation: {
        type: 'string',
        description: 'Filter by specific Crown corporation name',
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
        tool: 'search_crown_corporations',
        query: '',
        error: 'No search query provided. Specify a Crown corporation name or financial topic.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);

  const result = await searchGovData(`Crown corporation annual report financial ${query}`, 'federal', limit);

  return {
    content: {
      tool: 'search_crown_corporations',
      query,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
