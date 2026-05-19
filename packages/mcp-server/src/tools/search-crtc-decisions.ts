import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_crtc_decisions',
  description:
    'Search CRTC (Canadian Radio-television and Telecommunications Commission) regulatory decisions — ' +
    'broadcasting licenses, telecom rulings, ownership changes, net neutrality decisions, ' +
    'and consumer protection orders. Covers all CRTC public notices and decisions.',
  descriptions: {
    'fr-CA': 'Rechercher les décisions réglementaires du CRTC — licences de radiodiffusion, décisions en télécommunications, changements de propriété, neutralité du net et ordonnances de protection des consommateurs.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — decision number, company name, regulatory topic, or decision type (e.g., "broadcasting license CBC", "net neutrality zero rating", "telecom competition wireless")',
      },
      category: {
        type: 'string',
        enum: ['broadcasting', 'telecom', 'ownership', 'net_neutrality', 'consumer', 'all'],
        description: 'CRTC decision category filter (default: all)',
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
        tool: 'search_crtc_decisions',
        query: '',
        error: 'No search query provided. Specify a decision number, company, or regulatory topic.',
      },
      isError: true,
    };
  }

  const category = (args.category as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const categoryFilters: Record<string, string> = {
    broadcasting: 'broadcasting license radio television',
    telecom: 'telecom telecommunications wireless internet',
    ownership: 'ownership transfer acquisition media',
    net_neutrality: 'net neutrality zero rating traffic management',
    consumer: 'consumer protection complaint billing',
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
      tool: 'search_crtc_decisions',
      query,
      category,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
