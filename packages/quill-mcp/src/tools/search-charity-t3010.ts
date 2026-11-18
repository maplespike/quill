// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';
import { applySourcePolicy } from '@maplespike/pipeline-core';

/**
 * CRA T3010 Registered Charity Information Return search.
 *
 * Licence policy: charity records can name officers and directors; the
 * licences do not grant personal-information rights, so results are
 * minimized via applySourcePolicy('cra-charity', …).
 */
export const definition: ToolDefinition = {
  name: 'search_charity_t3010',
  description:
    'Search CRA T3010 Registered Charity Information Return data. ' +
    'Covers detailed financial statements, director compensation, political activities, ' +
    'program spending, and revenue breakdowns for charities that have filed a T3010 return — ' +
    'charities exempt from filing, or below the filing threshold, will not appear. ' +
    'More focused on T3010 returns than the general charity search.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — charity name, BN, or category (e.g., "Salvation Army", "environment", "religious")',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 20)',
      },
    },
    required: ['query'],
  },
};

/** Core search — injectable fetcher for tests; applies the source licence policy. */
export async function runSearchCharityT3010(
  args: { query: string; limit?: number },
  fetchFn: typeof searchCkan = searchCkan,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = args.query;
  const limit = Number(args.limit ?? 20);
  try {
    const result = await fetchFn(`charity t3010 ${query}`, limit);
    const applied = applySourcePolicy('cra-charity', result.results);
    return {
      content: {
        tool: 'search_charity_t3010',
        query,
        limit,
        results: applied.records,
        total: result.total,
        policy: applied.policy,
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_charity_t3010',
        query,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
}

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Number(args.limit ?? 20);
  if (!query.trim()) {
    return { content: { tool: 'search_charity_t3010', query: '', error: 'No search query provided.' }, isError: true };
  }
  return runSearchCharityT3010({ query, limit });
};
