// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';
import { applySourcePolicy } from '@maplespike/pipeline-core';

/**
 * CRA registered charity T3010 search.
 *
 * Licence policy: charity records can name officers and directors; the
 * licences do not grant personal-information rights, so results are
 * minimized (no personal contact details) via applySourcePolicy('cra-charity', …).
 */
export const definition: ToolDefinition = {
  name: 'search_cra_charity',
  description:
    'Search CRA (Canada Revenue Agency) registered charity T3010 data. ' +
    'Covers detailed financials, directors, programs, and political activities ' +
    'for charities with a published T3010 return. Charities exempt from filing, ' +
    'or below the filing threshold, will not appear.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — charity name, BN/registration number, or keyword (e.g., "United Way", "climate justice", "registered charity")',
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
export async function runSearchCraCharity(
  args: { query: string; limit?: number },
  fetchFn: typeof searchCkan = searchCkan,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = args.query;
  const limit = Number(args.limit ?? 20);

  try {
    const result = await fetchFn(query, limit);
    const applied = applySourcePolicy('cra-charity', result.results);
    return {
      content: {
        tool: 'search_cra_charity',
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
        tool: 'search_cra_charity',
        query,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
}

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  if (!query.trim()) {
    return {
      content: {
        tool: 'search_cra_charity',
        query: '',
        error: 'No search query provided. Try a charity name, registration number, or keyword.',
      },
      isError: true,
    };
  }
  return runSearchCraCharity({ query, limit: Number(args.limit ?? 20) });
};
