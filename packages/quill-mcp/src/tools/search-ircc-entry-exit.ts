// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_ircc_entry_exit',
  description:
    'Search IRCC quarterly entry/exit data by port of entry, mode of travel, and nationality. ' +
    'Covers traveller volumes at Canadian ports of entry including airports, land borders, and marine ports.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — port of entry, nationality, or quarter (e.g., "Toronto Pearson", "US citizens", "Q1 2024")',
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
    return { content: { tool: 'search_ircc_entry_exit', query: '', error: 'No search query provided. Try a port, nationality, or quarter.' }, isError: true };
  }
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_ircc_entry_exit', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_ircc_entry_exit', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
