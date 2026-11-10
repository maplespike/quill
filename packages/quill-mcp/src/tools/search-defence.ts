// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_defence',
  description:
    'Search Canadian defence and veterans data including ' +
    'DND regular force personnel by rank (1997-2025), ' +
    'Defence Capabilities Blueprint procurement data, ' +
    'Veterans Affairs Canada wait times, suicide prevention data, and service statistics.',
  descriptions: {
    'fr-CA': 'Rechercher des données sur la défense et les anciens combattants canadiens, y compris les effectifs de la Force régulière du MDN par grade, les données d\'approvisionnement du Plan des capacités de défense, les temps d\'attente d\'ACC et les statistiques de services.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — branch, rank, procurement category, or year (e.g., "Regular Force by rank 2024", "defence procurement shipbuilding", "Veterans wait times")',
      },
      source: {
        type: 'string',
        enum: ['dnd', 'vac', 'all'],
        description: 'Source filter: DND (personnel/procurement), VAC (veterans services)',
      },
      year: {
        type: 'number',
        description: 'Filter by year',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum results (default: 10)',
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
        tool: 'search_defence',
        query: '',
        error: 'No search query provided. Try "defence personnel 2024" or "Veterans Affairs wait times".',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);
  const year = args.year as number | undefined;
  const source = (args.source as string) ?? 'all';

  const q = query + (year ? ` ${year}` : '');
  const result = await searchCkan(q, limit);

  return {
    content: {
      tool: 'search_defence',
      query,
      year,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
