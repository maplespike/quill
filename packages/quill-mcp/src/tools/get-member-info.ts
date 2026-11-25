// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchPoliticians } from './upstream-fetcher.js';
import { applySourcePolicy, presentParliamentaryToolResult } from '@maplespike/pipeline-core';

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

/** Core lookup — injectable fetcher for tests. Member records are discovery-only. */
export async function runGetMemberInfo(
  args: { query?: string; limit?: number },
  fetchFn: typeof fetchPoliticians = fetchPoliticians,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = String(args.query ?? '');
  const limit = Math.min(args.limit ?? 10, 50);
  if (!query.trim()) {
    return presentParliamentaryToolResult({ content: { tool: 'get_member_info', error: 'No query provided' }, isError: true }, { chamber: 'commons' });
  }
  try {
    const { results, total } = await fetchFn(query, limit);
    const applied = applySourcePolicy('openparliament', results);
    return presentParliamentaryToolResult({
      content: {
        tool: 'get_member_info',
        query,
        limit,
        members: applied.records,
        totalCount: total,
        policy: applied.policy,
      },
    }, { chamber: 'commons' });
  } catch (error) {
    return presentParliamentaryToolResult({ content: { tool: 'get_member_info', status: 'error', error: (error as Error).message }, isError: true }, { chamber: 'commons' });
  }
}

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  return runGetMemberInfo({
    query: args.query as string | undefined,
    limit: args.limit as number | undefined,
  });
};
