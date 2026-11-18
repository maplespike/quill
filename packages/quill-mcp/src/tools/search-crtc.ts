// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_crtc',
  description:
    'Search CRTC (Canadian Radio-television and Telecommunications Commission) data — ' +
    'broadcasting and telecom regulatory decisions, ownership changes, ' +
    'net neutrality rulings, and licensing decisions.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — company, decision type, or topic (e.g., "Bell Mobility", "net neutrality", "broadcasting licence")',
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
    return { content: { tool: 'search_crtc', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_crtc', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_crtc', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
