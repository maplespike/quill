// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchPoliticians } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'get_member_info',
  description: 'Get information about current and former Members of Parliament via Open Parliament. Returns name, party, riding, and photo URL. Use this to look up MP details by name.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 2000, description: 'MP name or riding (e.g., "Trudeau", "Edmonton", "Liberal")' },
      limit: { type: 'number', minimum: 1, maximum: 50, description: 'Max results (default: 10)' },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Math.min((args.limit as number) ?? 10, 50);
  if (!query.trim()) {
    return { content: { tool: 'get_member_info', error: 'No query provided' }, isError: true };
  }
  try {
    const { results, total } = await fetchPoliticians(query, limit);
    return { content: { tool: 'get_member_info', query, limit, members: results, totalCount: total } };
  } catch (error) {
    return { content: { tool: 'get_member_info', status: 'error', error: (error as Error).message }, isError: true };
  }
};
