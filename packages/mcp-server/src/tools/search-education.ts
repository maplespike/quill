import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords, getPipelineData, liveFetch } from './pipeline-data.js';

/**
 * Search Canadian education and research data including Tri-Council grants
 * (CIHR, NSERC, SSHRC), Canada Research Chair allocations, Canada Foundation
 * for Innovation funding, Canada Student Loans statistics, CUDO university
 * enrolment data, and federal research infrastructure investments.
 */
export const definition: ToolDefinition = {
  name: 'search_education',
  description:
    'Search Canadian education and research data including Tri-Council grants ' +
    '(CIHR, NSERC, SSHRC), Canada Research Chair allocations, Canada Foundation ' +
    'for Innovation funding, Canada Student Loans statistics, CUDO university ' +
    'enrolment data, and federal research infrastructure investments.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — e.g., "NSERC grant 2024", "Canada Research Chair", "student loans"',
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
      content: { tool: 'search_education', query: '', error: 'No search query provided.' },
      isError: true,
    };
  }
  const limit = Math.min((args.limit as number) ?? 10, 50);
  const sourceKeys = ['education-research', 'science-research', 'universities-deep'];
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
    content: { tool: 'search_education', query, limit, results, totalCount: total },
  };
};
