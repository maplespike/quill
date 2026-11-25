import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';
import { applySourcePolicy } from '@maplespike/pipeline-core';

export const definition: ToolDefinition = {
  name: 'search_sedi',
  description:
    'Search SEDI (System for Electronic Disclosure by Insiders) insider trading data. ' +
    'Covers TSX-listed company executive and director stock transactions, ' +
    'including purchases, sales, and option exercises.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — issuer name, insider name, or ticker (e.g., "Shopify", "Royal Bank", "SU.TO")',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 20)',
      },
    },
    required: ['query'],
  },
};

/** Core search — injectable fetcher for tests. SEDI records are link-only. */
export async function runSearchSedi(
  args: { query?: string; limit?: number },
  fetchFn: typeof searchCkan = searchCkan,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = String(args.query ?? '');
  const limit = Number(args.limit ?? 20);

  if (!query.trim()) {
    return {
      content: {
        tool: 'search_sedi',
        query: '',
        error: 'No search query provided. Try a company name, insider name, or ticker symbol.',
      },
      isError: true,
    };
  }

  try {
    const result = await fetchFn(query, limit);
    const applied = applySourcePolicy('sedi', result.results);
    return {
      content: {
        tool: 'search_sedi',
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
        tool: 'search_sedi',
        query,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
}

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  return runSearchSedi({
    query: args.query as string | undefined,
    limit: args.limit as number | undefined,
  });
};
