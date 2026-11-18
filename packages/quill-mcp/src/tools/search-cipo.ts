// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_cipo',
  description:
    'Search CIPO (Canadian Intellectual Property Office) data — patents, trademarks, ' +
    'industrial designs, and copyright registrations filed in Canada.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — applicant, technology area, or trademark (e.g., "AI patent", "Nortel", "brand trademark")',
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
    return { content: { tool: 'search_cipo', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_cipo', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_cipo', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
