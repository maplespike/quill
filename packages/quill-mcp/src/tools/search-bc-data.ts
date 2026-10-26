// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchProvincialData } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_bc_data',
  description: 'Search British Columbia (BC) government open data — PharmaCare, BCPNP immigration, BC Provincial Court records, BC Ministry of Education reports, health, environment, and more. Queries catalogue.data.gov.bc.ca CKAN portal.',
  descriptions: {
    'fr-CA': 'Rechercher des données ouvertes du gouvernement de la Colombie-Britannique — données de santé, d\'éducation, d\'immigration, de tribunaux et plus.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 2000, description: 'Search terms (e.g., "health", "immigration", "education", "transportation")' },
      limit: { type: 'number', minimum: 1, maximum: 50, description: 'Maximum results to return (default: 10)' },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '').trim();
  const limit = Math.min((args.limit as number) ?? 10, 50);
  if (!query) return { content: { tool: 'search_bc_data', error: 'No query' }, isError: true };

  try {
    const result = await fetchProvincialData('bc', query, limit);
    return {
      content: {
        tool: 'search_bc_data',
        query,
        limit,
        results: result.results,
        totalCount: result.total,
        province: 'British Columbia',
        source: 'https://catalogue.data.gov.bc.ca',
        license: 'Dataset-specific publisher license declarations are included on individual results where supplied; no blanket BC license is asserted.',
        retrievedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return { content: { tool: 'search_bc_data', error: (error as Error).message }, isError: true };
  }
};
