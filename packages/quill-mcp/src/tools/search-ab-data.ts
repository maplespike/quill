// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchProvincialData } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_ab_data',
  description: 'Search Alberta (AB) government open data — AHS health indicators, AAIP/AINP immigration, Alberta Court of Justice records, education assessments, environment, and more. Queries open.alberta.ca CKAN portal.',
  descriptions: {
    'fr-CA': 'Rechercher des données ouvertes du gouvernement de l\'Alberta — données de santé, d\'éducation, d\'immigration, de tribunaux et plus.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 500, description: 'Search terms (e.g., "health", "immigration", "education", "energy")' },
      limit: { type: 'number', minimum: 1, maximum: 50, description: 'Maximum results to return (default: 10)' },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '').trim();
  const limit = Math.min((args.limit as number) ?? 10, 50);
  if (!query) return { content: { tool: 'search_ab_data', error: 'No query' }, isError: true };

  try {
    const result = await fetchProvincialData('ab', query, limit);
    return {
      content: {
        tool: 'search_ab_data',
        query,
        limit,
        results: result.results,
        totalCount: result.total,
        province: 'Alberta',
        source: 'https://open.alberta.ca',
        license: 'Dataset-specific publisher license declarations are included on individual results where supplied; no blanket Alberta license is asserted.',
        retrievedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return { content: { tool: 'search_ab_data', error: (error as Error).message }, isError: true };
  }
};
