import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_charity_t3010',
  description:
    'Search CRA Charity T3010 registered charity data — detailed financials of every registered ' +
    'Canadian charity including revenue, expenditures, political activities, director compensation, ' +
    'and charitable program spending. Updated annually from CRA filings.',
  descriptions: {
    'fr-CA': 'Rechercher des données de l\'ARC sur les organismes de bienfaisance enregistrés (T3010) — détails financiers incluant revenus, dépenses, activités politiques et dépenses de programmes caritatifs.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — charity name, BN/registration number, or cause area (e.g., "United Way Toronto", "environmental charity", "political activity spending")',
      },
      province: {
        type: 'string',
        description: 'Filter by province of registration',
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
        tool: 'search_charity_t3010',
        query: '',
        error: 'No search query provided. Specify a charity name, BN, or cause area.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);

  const result = await searchGovData(`charity T3010 CRA registered ${query}`, 'federal', limit);

  return {
    content: {
      tool: 'search_charity_t3010',
      query,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
