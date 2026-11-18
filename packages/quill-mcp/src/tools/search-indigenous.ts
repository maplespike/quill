// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_indigenous_relations',
  description:
    'Search Indigenous relations data including CIRNAC specific claims, ' +
    'ISC First Nations financial transparency (chief/council salaries, community budgets), ' +
    'TRC Calls to Action tracker, Jordan\'s Principle funding, and MMIWG follow-up data. ' +
    'Covers land claims, infrastructure spending, and community well-being indices.',
  descriptions: {
    'fr-CA': 'Rechercher des données sur les relations avec les Autochtones, y compris les revendications particulières de RCAANC, la transparence financière des Premières Nations de SPIC (salaires des chefs/conseillers, budgets communautaires), le suivi des appels à l\'action de la CVR, le financement du principe de Jordan et les données de suivi des FFADA.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — community, province, claim type, or year (e.g., "specific claims Ontario", "TRC calls to action", "Jordan\'s Principle")',
      },
      source: {
        type: 'string',
        enum: ['cirnac', 'isc', 'trc', 'all'],
        description: 'Source filter: CIRNAC (land claims), ISC (financial transparency), TRC (Calls to Action)',
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
        tool: 'search_indigenous_relations',
        query: '',
        error: 'No search query provided. Try "specific claims Ontario" or "TRC Calls to Action 2024".',
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
      tool: 'search_indigenous_relations',
      query,
      year,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
