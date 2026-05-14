import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords, getPipelineData, liveFetch } from './pipeline-data.js';

/**
 * Search Canadian health data including PHAC disease surveillance, CFIA food
 * recalls, Health Canada drug approvals and safety alerts, CIHI hospital
 * spending and wait times, CADTH drug reimbursement reviews, and PMPRB
 * patented medicine price trends.
 */
export const definition: ToolDefinition = {
  name: 'search_health',
  description:
    'Search Canadian health data including PHAC disease surveillance, CFIA food recalls, ' +
    'Health Canada drug approvals and safety alerts, CIHI hospital spending and wait times, ' +
    'CADTH drug reimbursement reviews, and PMPRB patented medicine price trends.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — e.g., "PHAC surveillance 2024", "drug approval", "CIHI wait times"',
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
      content: { tool: 'search_health', query: '', error: 'No search query provided.' },
      isError: true,
    };
  }
  const limit = Math.min((args.limit as number) ?? 10, 50);
  const sourceKeys = ['health-canada', 'health-data', 'oversight'];
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
    content: { tool: 'search_health', query, limit, results, totalCount: total },
  };
};
