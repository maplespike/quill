// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_pharmaceuticals',
  description:
    'Search Pharmaceuticals & Drug Policy data — PMPRB drug pricing, Health Canada Drug Product Database, ' +
    'drug shortages, and CADTH reviews. Covers Canadian pharmaceutical regulation and pricing.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — drug name, manufacturer, active ingredient, or therapeutic class (e.g., "insulin pricing", "drug shortage Canada", "PMPRB")',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 20)',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Number(args.limit ?? 20);
  if (!query.trim()) {
    return { content: { tool: 'search_pharmaceuticals', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(query + ' pharmaceuticals drug', limit);
    return { content: { tool: 'search_pharmaceuticals', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_pharmaceuticals', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
