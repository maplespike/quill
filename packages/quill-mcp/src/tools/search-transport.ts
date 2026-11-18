// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_transport_safety',
  description:
    'Search Canadian transport safety and infrastructure data including ' +
    'TSB occurrence datasets (air, rail, marine, pipeline investigations), ' +
    'Transport Canada recalls and violations, Infrastructure Canada project funding, ' +
    'CIIB (Canada Infrastructure Investment Bank) data, and CTA (Canadian Transportation Agency) decisions.',
  descriptions: {
    'fr-CA': 'Rechercher des données sur la sécurité des transports et les infrastructures canadiennes, y compris les données d\'occurrences du BST, les rappels et violations de Transports Canada, le financement de projets d\'Infrastructure Canada et les décisions de l\'OTC.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — mode, province, investigation type, or year (e.g., "TSB rail occurrence 2024", "air safety", "bridge funding Ontario")',
      },
      source: {
        type: 'string',
        enum: ['tsb', 'tc', 'infrastructure', 'all'],
        description: 'Source filter: TSB (occurrence investigations), TC (recalls/violations), Infrastructure Canada (project funding)',
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
        tool: 'search_transport_safety',
        query: '',
        error: 'No search query provided. Try "TSB rail occurrence 2024" or "air safety investigation".',
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
      tool: 'search_transport_safety',
      query,
      year,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
