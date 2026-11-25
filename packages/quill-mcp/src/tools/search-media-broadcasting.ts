import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';
import { applySourcePolicy } from '@maplespike/pipeline-core';

export const definition: ToolDefinition = {
  name: 'search_media_broadcasting',
  description:
    'Search Media & Broadcasting data — CRTC ownership, government ad spending, and BBM audience data.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — keyword, location, or category (e.g., relevant search terms for this dataset)',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 20)',
      },
    },
    required: ['query'],
  },
};

/** Core search — injectable fetcher for tests. Media records are link-only. */
export async function runSearchMediaBroadcasting(
  args: { query?: string; limit?: number },
  fetchFn: typeof searchCkan = searchCkan,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = String(args.query ?? '');
  const limit = Number(args.limit ?? 20);
  if (!query.trim()) {
    return { content: { tool: 'search_media_broadcasting', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await fetchFn(query + ' media broadcasting CRTC', limit);
    const applied = applySourcePolicy('media-broadcasting', result.results);
    return {
      content: {
        tool: 'search_media_broadcasting',
        query,
        limit,
        results: applied.records,
        total: result.total,
        policy: applied.policy,
      },
    };
  } catch (err) {
    return { content: { tool: 'search_media_broadcasting', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
}

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  return runSearchMediaBroadcasting({
    query: args.query as string | undefined,
    limit: args.limit as number | undefined,
  });
};
