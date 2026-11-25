import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestAllNgoRss, searchNgoRss, applySourcePolicy } from '@maplespike/pipeline-core';

export const definition: ToolDefinition = {
  name: 'search_ngo_rss',
  description:
    'Search NGO and think tank publications ingested from RSS feeds — policy papers, reports, ' +
    'press releases, and articles from 30+ tracked organizations. Returns article titles, URLs, ' +
    'publication dates, and narrative classification flags. Results are cross-referenceable against ' +
    'lobbying records and committee mentions.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search term for NGO/think tank publications (e.g., "carbon tax", "housing", "digital")',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 20)',
      },
    },
    required: ['query'],
  },
};

/** Core search — injectable ingest for tests. NGO RSS is link-only (300-char excerpts). */
export async function runSearchNgoRss(
  args: { query?: string; limit?: number },
  ingestFn: typeof ingestAllNgoRss = ingestAllNgoRss,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = String(args.query ?? '');
  const limit = Number(args.limit ?? 20);

  if (!query.trim()) {
    return {
      content: {
        tool: 'search_ngo_rss',
        query: '',
        error: 'No search query provided. Please specify search terms.',
      },
      isError: true,
    };
  }

  try {
    const all = await ingestFn();
    const results = searchNgoRss(all.items, query);
    const applied = applySourcePolicy('ngo-influence-rss', results.slice(0, limit));

    return {
      content: {
        tool: 'search_ngo_rss',
        query,
        limit,
        total: results.length,
        sourcesAttempted: all.sourcesAttempted,
        sourcesSucceeded: all.sourcesSucceeded,
        items: applied.records,
        policy: applied.policy,
        errors: all.errors.length > 0 ? all.errors.slice(0, 5) : undefined,
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_ngo_rss',
        query,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
}

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  return runSearchNgoRss({
    query: args.query as string | undefined,
    limit: args.limit as number | undefined,
  });
};
