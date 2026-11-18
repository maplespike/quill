// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_telecommunications',
  description:
    'Search Telecommunications & Digital data — CRTC market reports, ISED spectrum management, ' +
    'CIRA internet data, and broadband coverage across Canada.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — provider, technology, or region (e.g., "broadband rural Ontario", "spectrum auction", "CRTC telecom")',
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
    return { content: { tool: 'search_telecommunications', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(query + ' telecommunications broadband', limit);
    return { content: { tool: 'search_telecommunications', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_telecommunications', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
