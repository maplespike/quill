// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchParliamentBills } from './upstream-fetcher.js';
import { presentParliamentaryToolResult, type ParliamentaryChamber } from '@maplespike/pipeline-core';

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

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Math.min((args.limit as number) ?? 10, 50);
  const chamber = chamberForBillQuery(query);
  if (!query.trim()) {
    return presentParliamentaryToolResult(
      { content: { tool: 'search_bills', error: 'No query provided' }, isError: true },
      { chamber: 'both' },
    );
  }
  try {
    const { results, total } = await fetchParliamentBills(query, limit);
    return presentParliamentaryToolResult(
      { content: { tool: 'search_bills', query, limit, results, totalCount: total } },
      { chamber },
    );
  } catch (error) {
    return presentParliamentaryToolResult(
      { content: { tool: 'search_bills', status: 'error', error: (error as Error).message }, isError: true },
      { chamber },
    );
  }
};
