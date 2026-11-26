// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchParliamentBills } from './upstream-fetcher.js';
import { applySourcePolicy, presentParliamentaryToolResult, type ParliamentaryChamber } from '@maplespike/pipeline-core';


function chamberForBillQuery(query: string): ParliamentaryChamber {
  const senate = /\bS-\d/i.test(query);
  const commons = /\bC-\d/i.test(query);
  if (senate && !commons) return 'senate';
  if (commons && !senate) return 'commons';
  return 'both';
}

export const definition: ToolDefinition = {
  name: 'search_bills',
  description: 'Search federal parliamentary bills via Open Parliament. Returns bill numbers, names, sessions, and LEGISinfo IDs. Use this to track legislation progress.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 2000, description: 'Search term (e.g., "budget", "climate", "C-")' },
      limit: { type: 'number', minimum: 1, maximum: 50, description: 'Max results (default: 10)' },
    },
    required: ['query'],
  },
};

/** Core search — injectable fetcher for tests. Bills are discovery-only. */
export async function runSearchBills(
  args: { query?: string; limit?: number },
  fetchFn: typeof fetchParliamentBills = fetchParliamentBills,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = String(args.query ?? '');
  const chamber = chamberForBillQuery(query);
  const limit = Math.min(args.limit ?? 10, 50);
  if (!query.trim()) {
    return presentParliamentaryToolResult({ content: { tool: 'search_bills', error: 'No query provided' }, isError: true }, { chamber: chamber });
  }
  try {
    const { results, total } = await fetchFn(query, limit);
    const applied = applySourcePolicy('openparliament', results);
    return presentParliamentaryToolResult({
      content: {
        tool: 'search_bills',
        query,
        limit,
        results: applied.records,
        totalCount: total,
        policy: applied.policy,
      },
    }, { chamber: chamber });
  } catch (error) {
    return presentParliamentaryToolResult({ content: { tool: 'search_bills', status: 'error', error: (error as Error).message }, isError: true }, { chamber: chamber });
  }
}

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  return runSearchBills({
    query: args.query as string | undefined,
    limit: args.limit as number | undefined,
  });
};
