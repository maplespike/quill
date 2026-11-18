// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_global_canada',
  description:
    'Search Global Canada data — Global Affairs Canada trade agreements, ' +
    'ECCC climate and environmental data, CSIS reports metadata, and international relations data.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — country, agreement, or topic (e.g., "CUSMA trade", "Paris Agreement", "climate emissions")',
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
  if (!query.trim()) return { content: { tool: 'search_global_canada', query: '', error: 'No search query provided.' }, isError: true };
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_global_canada', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_global_canada', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
