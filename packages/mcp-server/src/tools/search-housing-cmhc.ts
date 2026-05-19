import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_housing_cmhc',
  description:
    'Search CMHC (Canada Mortgage and Housing Corporation) housing market data — housing starts, ' +
    'rental market reports, home price indices, mortgage arrears, and affordability measures. ' +
    'Covers national and metropolitan housing market indicators.',
  descriptions: {
    'fr-CA': 'Rechercher des données sur le marché du logement de la SCHL — mises en chantier, rapports sur le marché locatif, indices des prix des maisons, arriérés hypothécaires et mesures d\'accessibilité.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — housing metric, city/region, or market topic (e.g., "housing starts Toronto 2025", "rental vacancy rate Vancouver", "home price index Montreal")',
      },
      metric: {
        type: 'string',
        enum: ['housing_starts', 'rental_market', 'price_index', 'mortgage_arrears', 'affordability', 'all'],
        description: 'Housing metric filter (default: all)',
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
        tool: 'search_housing_cmhc',
        query: '',
        error: 'No search query provided. Specify a housing metric, city, or market topic.',
      },
      isError: true,
    };
  }

  const metric = (args.metric as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const categoryFilters: Record<string, string> = {
    housing_starts: 'housing starts construction building',
    rental_market: 'rental vacancy rate CMHC survey',
    price_index: 'home price index HPI MLS',
    mortgage_arrears: 'mortgage arrears delinquency default',
    affordability: 'housing affordability income price',
  };

  let searchQuery = query;
  if (metric !== 'all') {
    const filter = categoryFilters[metric];
    if (filter) {
      searchQuery = `${filter} ${query}`;
    }
  }

  const result = await searchGovData(searchQuery, 'federal', limit);

  return {
    content: {
      tool: 'search_housing_cmhc',
      query,
      metric,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
