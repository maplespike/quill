// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchParliamentCommittees } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_committees_op',
  description: 'Search committees via Open Parliament API.',
  inputSchema: { type: 'object', properties: {
    query: { type: 'string', maxLength: 2000, description: 'Search term' },
    limit: { type: 'number', minimum: 1, maximum: 50, description: 'Max results' },
  }, required: ['query'] },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? ''); const limit = Math.min((args.limit as number) ?? 10, 50);
  if (!query.trim()) return { content: { tool: 'search_committees_op', error: 'No query' }, isError: true };
  try {
    const { results, total } = await fetchParliamentCommittees(query, limit);
    return { content: { tool: 'search_committees_op', query, limit, committees: results, totalCount: total } };
  } catch (error) {
    return { content: { tool: 'search_committees_op', status: 'error', error: (error as Error).message }, isError: true };
  }
};