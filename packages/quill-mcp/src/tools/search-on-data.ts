// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchProvincialData } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_on_data',
  description: 'Search Ontario (ON) government open data — OHIP health claims, OINP immigration, EQAO education results, court dockets, environment, and more. Queries data.ontario.ca CKAN portal.',
  descriptions: {
    'fr-CA': 'Rechercher des données ouvertes du gouvernement de l\'Ontario — données de santé, d\'éducation, d\'immigration, de tribunaux et plus.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 2000, description: 'Search terms (e.g., "health", "immigration", "education", "environment")' },
      limit: { type: 'number', minimum: 1, maximum: 50, description: 'Maximum results to return (default: 10)' },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '').trim();
  const limit = Math.min((args.limit as number) ?? 10, 50);
  if (!query) return { content: { tool: 'search_on_data', error: 'No query' }, isError: true };

  try {
    const result = await fetchProvincialData('on', query, limit);
    return {
      content: {
        tool: 'search_on_data',
        query,
        limit,
        results: result.results,
        totalCount: result.total,
        province: 'Ontario',
        source: 'https://data.ontario.ca',
        license: 'Dataset-specific publisher license declarations are included on individual results where supplied; no blanket Ontario license is asserted.',
        retrievedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return { content: { tool: 'search_on_data', error: (error as Error).message }, isError: true };
  }
};
