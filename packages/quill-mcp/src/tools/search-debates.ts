// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchParliamentDebates } from './upstream-fetcher.js';
import { applySourcePolicy, presentParliamentaryToolResult } from '@maplespike/pipeline-core';

export const definition: ToolDefinition = {
  name: 'search_debates',
  description: 'Search House of Commons debates via Open Parliament. Returns debate dates, numbers, and most frequent words. Use this to find what Parliament discussed on specific dates or topics.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 2000, description: 'Search term (e.g., "carbon", "housing", "health")' },
      limit: { type: 'number', minimum: 1, maximum: 50, description: 'Max results (default: 10)' },
    },
    required: ['query'],
  },
};

/** Core search — injectable fetcher for tests. House debates are discovery-only. */
export async function runSearchDebates(
  args: { query?: string; limit?: number },
  fetchFn: typeof fetchParliamentDebates = fetchParliamentDebates,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = String(args.query ?? '');
  const limit = Math.min(args.limit ?? 10, 50);
  if (!query.trim()) {
    return presentParliamentaryToolResult({ content: { tool: 'search_debates', error: 'No query provided' }, isError: true }, { chamber: 'commons' });
  }
  try {
    const { results, total } = await fetchFn(query, limit);
    const applied = applySourcePolicy('openparliament', results);
    return presentParliamentaryToolResult({
      content: {
        tool: 'search_debates',
        query,
        limit,
        results: applied.records,
        totalCount: total,
        policy: applied.policy,
      },
    }, { chamber: 'commons' });
  } catch (error) {
    return presentParliamentaryToolResult({ content: { tool: 'search_debates', status: 'error', error: (error as Error).message }, isError: true }, { chamber: 'commons' });
  }
}

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  return runSearchDebates({
    query: args.query as string | undefined,
    limit: args.limit as number | undefined,
  });
};
