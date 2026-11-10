// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestAllNgoRss, searchNgoRss } from '@maplespike/pipeline-core';

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

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
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
    const all = await ingestAllNgoRss();
    const results = searchNgoRss(all.items, query);
    const sliced = results.slice(0, limit);

    return {
      content: {
        tool: 'search_ngo_rss',
        query,
        limit,
        total: results.length,
        sourcesAttempted: all.sourcesAttempted,
        sourcesSucceeded: all.sourcesSucceeded,
        items: sliced,
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
};
