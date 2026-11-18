// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_npri',
  description:
    'Search National Pollutant Release Inventory (NPRI) data — facility-level pollutant releases, ' +
    'disposals, and transfers by substance, facility, and location across Canada.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — facility name, substance, or location (e.g., "mercury", "Syncrude", "chemical release Ontario")',
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
    return { content: { tool: 'search_npri', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_npri', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_npri', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
