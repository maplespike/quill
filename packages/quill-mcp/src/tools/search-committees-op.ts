// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchParliamentCommittees } from './upstream-fetcher.js';
import { applySourcePolicy } from '@maplespike/pipeline-core';

export const definition: ToolDefinition = {
  name: 'search_committees_op',
  description: 'Search committees via Open Parliament API.',
  inputSchema: { type: 'object', properties: {
    query: { type: 'string', maxLength: 2000, description: 'Search term' },
    limit: { type: 'number', minimum: 1, maximum: 50, description: 'Max results' },
  }, required: ['query'] },
};

/**
 * Core search — injectable fetcher for tests. Committee content is
 * discovery-only; results pass through applySourcePolicy('committees', …).
 */
export async function runSearchCommitteesOp(
  args: { query: string; limit?: number },
  fetchFn: typeof fetchParliamentCommittees = fetchParliamentCommittees,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = args.query;
  const limit = Math.min(args.limit ?? 10, 50);
  try {
    const { results, total } = await fetchFn(query, limit);
    const applied = applySourcePolicy('committees', results);
    return {
      content: {
        tool: 'search_committees_op',
        query,
        limit,
        committees: applied.records,
        totalCount: total,
        policy: applied.policy,
      },
    };
  } catch (error) {
    return {
      content: { tool: 'search_committees_op', query, limit, status: 'error', error: (error as Error).message },
      isError: true,
    };
  }
}

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  if (!query.trim()) return { content: { tool: 'search_committees_op', error: 'No query' }, isError: true };
  return runSearchCommitteesOp({ query, limit: (args.limit as number) ?? 10 });
};
