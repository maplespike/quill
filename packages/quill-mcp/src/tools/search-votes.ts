// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchParliamentVotes } from './upstream-fetcher.js';
import { applySourcePolicy } from '@maplespike/pipeline-core';

export const definition: ToolDefinition = {
  name: 'search_votes',
  description: 'Search House of Commons voting records via Open Parliament.',
  inputSchema: { type: 'object', properties: {
    query: { type: 'string', maxLength: 2000, description: 'Search term' },
    limit: { type: 'number', minimum: 1, maximum: 50, description: 'Max results' },
  }, required: ['query'] },
};

/** Core search — injectable fetcher for tests. Votes are discovery-only. */
export async function runSearchVotes(
  args: { query?: string; limit?: number },
  fetchFn: typeof fetchParliamentVotes = fetchParliamentVotes,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = String(args.query ?? '');
  const limit = Math.min(args.limit ?? 10, 50);
  if (!query.trim()) return { content: { tool: 'search_votes', error: 'No query' }, isError: true };
  try {
    const { results, total } = await fetchFn(query, limit);
    const applied = applySourcePolicy('openparliament', results);
    return {
      content: {
        tool: 'search_votes',
        query,
        limit,
        results: applied.records,
        totalCount: total,
        policy: applied.policy,
      },
    };
  } catch (error) {
    return { content: { tool: 'search_votes', status: 'error', error: (error as Error).message }, isError: true };
  }
}

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  return runSearchVotes({
    query: args.query as string | undefined,
    limit: args.limit as number | undefined,
  });
};