import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';
import { projectFeedMetadata } from '@maplespike/pipeline-core';

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

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Number(args.limit ?? 20);
  if (!query.trim()) {
    return { content: { tool: 'search_media_broadcasting', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(query + ' media broadcasting CRTC', limit);
    return {
      content: {
        tool: 'search_media_broadcasting',
        query,
        limit,
        ...result,
        results: projectFeedMetadata(result.results),
      },
    };
  } catch (err) {
    return { content: { tool: 'search_media_broadcasting', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
