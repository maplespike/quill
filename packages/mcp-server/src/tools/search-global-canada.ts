import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_global_canada',
  description:
    'Search Global Affairs Canada data — trade agreements, export controls, ' +
    'international development assistance, consular services, and ECCC climate data. ' +
    'Covers GAC trade negotiations, CSIS threat reports, and Canada\'s international obligations.',
  descriptions: {
    'fr-CA': 'Rechercher des données d\'Affaires mondiales Canada — accords commerciaux, contrôles à l\'exportation, aide au développement international, services consulaires et données climatiques d\'ECCC.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — trade agreement, country, program, or climate topic (e.g., "CUSMA trade", "development aid Africa", "carbon pricing", "export permit")',
      },
      category: {
        type: 'string',
        enum: ['trade', 'development', 'climate', 'consular', 'all'],
        description: 'Category filter (default: all)',
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
        tool: 'search_global_canada',
        query: '',
        error: 'No search query provided. Specify a trade agreement, country, or program.',
      },
      isError: true,
    };
  }

  const category = (args.category as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const categoryFilters: Record<string, string> = {
    trade: 'trade agreement export import CUSMA',
    development: 'development aid assistance international',
    climate: 'climate change emissions carbon ECCC',
    consular: 'consular travel advisory passport',
  };

  let searchQuery = query;
  if (category !== 'all') {
    const filter = categoryFilters[category];
    if (filter) {
      searchQuery = `${filter} ${query}`;
    }
  }

  const result = await searchGovData(searchQuery, 'federal', limit);

  return {
    content: {
      tool: 'search_global_canada',
      query,
      category,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
