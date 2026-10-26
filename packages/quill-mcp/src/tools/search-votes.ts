// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchParliamentVotes } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_votes',
  description: 'Search House of Commons voting records via Open Parliament.',
  inputSchema: { type: 'object', properties: {
    query: { type: 'string', maxLength: 2000, description: 'Search term' },
    limit: { type: 'number', minimum: 1, maximum: 50, description: 'Max results' },
  }, required: ['query'] },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? ''); const limit = Math.min((args.limit as number) ?? 10, 50);
  if (!query.trim()) return { content: { tool: 'search_votes', error: 'No query' }, isError: true };
  try {
    const { results, total } = await fetchParliamentVotes(query, limit);
    return { content: { tool: 'search_votes', query, limit, results, totalCount: total } };
  } catch (error) {
    return { content: { tool: 'search_votes', status: 'error', error: (error as Error).message }, isError: true };
  }
};