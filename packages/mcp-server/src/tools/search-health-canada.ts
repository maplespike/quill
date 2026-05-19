import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_health_canada',
  description:
    'Search Health Canada data — drug approvals, medical device licenses, natural health products, ' +
    'recalls, safety alerts, and compliance actions. Covers the Health Products and Food Branch (HPFB) ' +
    'regulatory decisions and post-market surveillance.',
  descriptions: {
    'fr-CA': 'Rechercher des données de Santé Canada — approbations de médicaments, licences d\'instruments médicaux, produits de santé naturels, rappels et alertes de sécurité.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — drug name, DIN, device, recall, or health product (e.g., "drug approval Ozempic", "medical device recall", "natural health product licence")',
      },
      category: {
        type: 'string',
        enum: ['drugs', 'devices', 'natural_health', 'recalls', 'all'],
        description: 'Health product category filter (default: all)',
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
        tool: 'search_health_canada',
        query: '',
        error: 'No search query provided. Specify a drug name, DIN, device, or recall.',
      },
      isError: true,
    };
  }

  const category = (args.category as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const categoryFilters: Record<string, string> = {
    drugs: 'drug approval DIN notice of compliance',
    devices: 'medical device licence license',
    natural_health: 'natural health product NHP licence',
    recalls: 'recall safety alert advisory',
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
      tool: 'search_health_canada',
      query,
      category,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
