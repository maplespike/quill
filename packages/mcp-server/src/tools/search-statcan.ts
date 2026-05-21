import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_statcan',
  description:
    'Search Statistics Canada data — CPI inflation, GDP, labour force surveys, population estimates, ' +
    'trade balances, and economic indicators via the Statistics Canada Web Data Service (WDS). ' +
    'Covers all major statistical tables and indicators published by StatCan.',
  descriptions: {
    'fr-CA': 'Rechercher des données de Statistique Canada — IPC inflation, PIB, enquêtes sur la population active, estimations démographiques, balances commerciales et indicateurs économiques.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — indicator name, table ID, or economic topic (e.g., "CPI inflation April 2025", "GDP growth Q1", "unemployment rate Ontario")',
      },
      category: {
        type: 'string',
        enum: ['cpi', 'gdp', 'labour', 'population', 'trade', 'all'],
        description: 'Statistical category filter (default: all)',
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
        tool: 'search_statcan',
        query: '',
        error: 'No search query provided. Specify an indicator, table ID, or economic topic.',
      },
      isError: true,
    };
  }

  const category = (args.category as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);
  const traceId = args.traceId as string | undefined;

  const categoryFilters: Record<string, string> = {
    cpi: 'consumer price index inflation',
    gdp: 'gross domestic product economic output',
    labour: 'employment unemployment labour force',
    population: 'demographics census population',
    trade: 'imports exports trade balance',
  };

  let searchQuery = query;
  if (category !== 'all') {
    const filter = categoryFilters[category];
    if (filter) {
      searchQuery = `${filter} ${query}`;
    }
  }

  const result = await searchGovData(searchQuery, 'federal', limit, traceId);

  return {
    content: {
      tool: 'search_statcan',
      query,
      category,
      limit,
      traceId,
      results: result.results,
      totalCount: result.total,
    },
  };
};
