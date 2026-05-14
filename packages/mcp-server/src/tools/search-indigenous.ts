import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords, getPipelineData, liveFetch } from './pipeline-data.js';

/**
 * Search Canadian indigenous relations data including CIRNAC land claims,
 * ISC First Nations infrastructure spending, TRC Calls to Action status,
 * self-government agreements, and specific claims tribunal decisions.
 * Covers federal funding flows, community-level statistics, and
 * reconciliation progress tracking.
 */
export const definition: ToolDefinition = {
  name: 'search_indigenous',
  description:
    'Search Canadian indigenous relations data including CIRNAC land claims, ' +
    'ISC First Nations infrastructure spending, TRC Calls to Action status, ' +
    'self-government agreements, and specific claims tribunal decisions. ' +
    'Covers federal funding flows, community-level statistics, and reconciliation progress tracking.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — e.g., "land claims 2024", "TRC calls to action", "First Nations infrastructure"',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum results (default: 10)',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  if (!query.trim()) {
    return {
      content: { tool: 'search_indigenous', query: '', error: 'No search query provided.' },
      isError: true,
    };
  }
  const limit = Math.min((args.limit as number) ?? 10, 50);
  const sourceKeys = ['indigenous-relations', 'influence'];
  let results: any[];
  let total: number;
  if (getPipelineData()) {
    const result = searchRecords(sourceKeys, query, limit);
    results = result.results;
    total = result.total;
  } else {
    const liveResult = await liveFetch(sourceKeys, query, limit);
    results = liveResult.results;
    total = liveResult.total;
  }
  return {
    content: { tool: 'search_indigenous', query, limit, results, totalCount: total },
  };
};
