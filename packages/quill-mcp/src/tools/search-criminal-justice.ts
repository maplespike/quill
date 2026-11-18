// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_criminal_justice',
  description:
    'Search Canadian criminal justice and corrections data including ' +
    'CSC prison population statistics, Parole Board decisions, ' +
    'RCMP crime statistics (hate crimes, organized crime, youth justice), ' +
    'and PPSC prosecution service data.',
  descriptions: {
    'fr-CA': 'Rechercher des données sur la justice pénale et les services correctionnels canadiens, y compris les statistiques sur la population carcérale du SCC, les décisions de la Commission des libérations conditionnelles, les statistiques de la GRC sur les crimes haineux, le crime organisé et la justice pour les jeunes.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — institution, province, crime type, or year (e.g., "prison population Ontario 2024", "hate crimes", "parole granted")',
      },
      source: {
        type: 'string',
        enum: ['csc', 'parole', 'rcmp', 'all'],
        description: 'Source filter: CSC (corrections), Parole Board (decisions), RCMP (crime stats)',
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
        tool: 'search_criminal_justice',
        query: '',
        error: 'No search query provided. Try "prison population federal 2024" or "hate crimes Canada".',
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
      tool: 'search_criminal_justice',
      query,
      year,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
