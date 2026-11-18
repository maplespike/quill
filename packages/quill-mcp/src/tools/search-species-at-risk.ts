// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_species_at_risk',
  description:
    'Search Species at Risk Act (SARA) registry data — listing decisions, recovery strategies, ' +
    'action plans, and status assessments for Canadian species at risk.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — species name, status, or habitat (e.g., "woodland caribou", "endangered", "salmon")',
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
    return { content: { tool: 'search_species_at_risk', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_species_at_risk', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_species_at_risk', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
