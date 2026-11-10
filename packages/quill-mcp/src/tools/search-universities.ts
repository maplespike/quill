// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_universities',
  description:
    'Search Canadian university data — tuition fees, enrollment statistics, program costs, ' +
    'and institutional finances for the institutions present in the upstream dataset. ' +
    'Not every Canadian university publishes these figures, so absence is not evidence of absence.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — institution, program, or metric (e.g., "University of Toronto tuition", "engineering enrollment", "international students")',
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
  if (!query.trim()) return { content: { tool: 'search_universities', query: '', error: 'No search query provided.' }, isError: true };
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_universities', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_universities', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
