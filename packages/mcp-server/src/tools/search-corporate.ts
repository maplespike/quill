import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords, getPipelineData, liveFetch } from './pipeline-data.js';

/**
 * Search corporate registry data, federal lobbying records, procurement contracts,
 * and executive statements from Canadian companies.
 */
export const definition: ToolDefinition = {
  name: 'search_corporate',
  description:
    'Search Canadian corporate registry data, federal procurement contracts, ' +
    'lobbying registrations, and executive statements. Tracks insider transactions, ' +
    'sole-source contracts, company press releases, and corporate-government interactions. ' +
    'Cross-references with federal lobbying registry and proactive disclosure data.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — company name, executive name, or keyword (e.g., "Google", "sole source", "lobbying")',
      },
      dataset: {
        type: 'string',
        enum: ['lobbying', 'procurement', 'statements', 'all'],
        description: 'Corporate dataset to search (default: all)',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum results to return (default: 10)',
      },
    },
    required: ['query'],
  },
};

// Map dataset param to pipeline source keys
const datasetSourceMap: Record<string, string[]> = {
  lobbying: ['lobbying'],
  procurement: ['procurement'],
  statements: ['corporate'],
  all: ['corporate', 'lobbying', 'procurement'],
};

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  if (!query.trim()) {
    return {
      content: {
        tool: 'search_corporate',
        query: '',
        error: 'No search query provided. Please specify a company name, executive, or keyword.',
      },
      isError: true,
    };
  }

  const dataset = (args.dataset as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const sourceKeys = datasetSourceMap[dataset] || datasetSourceMap.all;

  // Try cached pipeline data first; fall back to live fetch if unavailable
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
    content: {
      tool: 'search_corporate',
      query,
      dataset,
      limit,
      results,
      totalCount: total,
    },
  };
};
