// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_crtc_decisions',
  description:
    'Search CRTC (Canadian Radio-television and Telecommunications Commission) decisions and rulings. ' +
    'Covers broadcasting decisions, telecom regulatory rulings, licensing renewals, ' +
    'ownership change approvals, and policy determinations. ' +
    'More specific to CRTC decisions than the general CRTC search.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — company, decision number, year, or topic (e.g., "2024-100", "Bell mobility acquisition", "broadcasting decision")',
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
    return { content: { tool: 'search_crtc_decisions', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(`crtc decision ${query}`, limit);
    return { content: { tool: 'search_crtc_decisions', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_crtc_decisions', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
