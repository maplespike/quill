import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_fisheries',
  description:
    'Search Fisheries and Oceans Canada (DFO) data — fish stock assessments, fishing licenses, ' +
    'aquaculture data, marine conservation areas, and fisheries management plans. ' +
    'Covers Pacific, Atlantic, Arctic, and freshwater fisheries across Canada.',
  descriptions: {
    'fr-CA': 'Rechercher des données de Pêches et Océans Canada — évaluations des stocks de poissons, permis de pêche, aquaculture, aires marines protégées et plans de gestion des pêches.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — species, region, license type, or conservation area (e.g., "salmon Pacific stock", "lobster license Atlantic", "marine protected area")',
      },
      region: {
        type: 'string',
        enum: ['pacific', 'atlantic', 'arctic', 'freshwater', 'all'],
        description: 'Fisheries region filter (default: all)',
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
        tool: 'search_fisheries',
        query: '',
        error: 'No search query provided. Specify a species, region, or license type.',
      },
      isError: true,
    };
  }

  const region = (args.region as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const result = await searchGovData(`fisheries DFO fish stock license ${region !== 'all' ? region + ' ' : ''}${query}`, 'federal', limit);

  return {
    content: {
      tool: 'search_fisheries',
      query,
      region,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
