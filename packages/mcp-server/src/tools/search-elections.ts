import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords, getPipelineData, liveFetch } from './pipeline-data.js';

/**
 * Search Elections Canada data — third-party advertiser registry, financial reports,
 * and spending records from registered third parties during federal election periods.
 */
export const definition: ToolDefinition = {
  name: 'search_elections',
  description:
    'Search Elections Canada third-party advertiser registry and financial reports. ' +
    'Tracks advertising spending, platforms used, election periods, and third-party ' +
    'organizations registered with Elections Canada. Cross-references with corporate ' +
    'and influence data to identify connected actors.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — third-party name, advertiser, or platform (e.g., "Canada Proud", "Facebook")',
      },
      electionPeriod: {
        type: 'string',
        description: 'Filter by election period year or label',
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

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  if (!query.trim()) {
    return {
      content: {
        tool: 'search_elections',
        query: '',
        error: 'No search query provided. Please specify a third-party name or advertiser.',
      },
      isError: true,
    };
  }

  const electionPeriod = (args.electionPeriod as string) ?? '';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  // Try cached pipeline data first; fall back to live fetch if unavailable
  let results: any[];
  let total: number;
  if (getPipelineData()) {
    const result = searchRecords(['elections'], query, limit);
    results = result.results;
    total = result.total;
  } else {
    const liveResult = await liveFetch(['elections'], query, limit);
    results = liveResult.results;
    total = liveResult.total;
  }

  // Apply election period filter if provided
  let filteredResults = results;
  if (electionPeriod) {
    const ep = electionPeriod.toLowerCase();
    filteredResults = results.filter((r: any) =>
      JSON.stringify(r).toLowerCase().includes(ep)
    );
  }

  return {
    content: {
      tool: 'search_elections',
      query,
      electionPeriod: electionPeriod || undefined,
      limit,
      results: filteredResults,
      totalCount: electionPeriod ? filteredResults.length : total,
    },
  };
};
