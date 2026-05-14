import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords, getPipelineData, liveFetch } from './pipeline-data.js';

/**
 * Search Canadian defence and military data including DND regular force personnel
 * by rank and element, defence procurement contracts, and National Defence
 * infrastructure projects. Covers historical personnel counts (1997-2025),
 * major equipment procurement, and defence policy documents.
 */
export const definition: ToolDefinition = {
  name: 'search_defence',
  description:
    'Search Canadian defence and military data including DND regular force personnel ' +
    'by rank and element, defence procurement contracts, and National Defence ' +
    'infrastructure projects. Covers historical personnel counts (1997-2025), ' +
    'major equipment procurement, and defence policy documents.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — e.g., "regular force 2024", "CF-18 procurement", "DND infrastructure"',
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
      content: { tool: 'search_defence', query: '', error: 'No search query provided.' },
      isError: true,
    };
  }
  const limit = Math.min((args.limit as number) ?? 10, 50);
  const sourceKeys = ['defence', 'veterans', 'goc-spending'];
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
    content: { tool: 'search_defence', query, limit, results, totalCount: total },
  };
};
