import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords, getPipelineData, liveFetch } from './pipeline-data.js';

/**
 * Search Canadian transportation safety and infrastructure data including
 * TSB occurrence datasets (air, rail, marine, pipeline), Transport Canada
 * recalls and violations, Canada Infrastructure Bank project funding,
 * CTA rulings, and infrastructure program spending.
 */
export const definition: ToolDefinition = {
  name: 'search_transport',
  description:
    'Search Canadian transportation safety and infrastructure data including TSB ' +
    'occurrence datasets (air, rail, marine, pipeline), Transport Canada recalls ' +
    'and violations, Canada Infrastructure Bank project funding, CTA rulings, and ' +
    'infrastructure program spending.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — e.g., "TSB rail occurrence 2024", "Transport Canada recall", "CIB funding"',
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
      content: { tool: 'search_transport', query: '', error: 'No search query provided.' },
      isError: true,
    };
  }
  const limit = Math.min((args.limit as number) ?? 10, 50);
  const sourceKeys = ['transport-infrastructure', 'regional-authorities'];
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
    content: { tool: 'search_transport', query, limit, results, totalCount: total },
  };
};
