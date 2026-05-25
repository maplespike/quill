import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

/**
 * Search Statistics Canada — CPI, GDP, labour, population, trade indicators via WDS.
 */
export const definition: ToolDefinition = {
  name: 'search_statcan',
  description:
    'Search Statistics Canada datasets including CPI, GDP, labour statistics, population data, ' +
    'trade indicators, and other key economic and social metrics from the Statistics Canada ' +
    'Web Data Service (WDS).',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms (e.g., "inflation", "unemployment", "population", specific dataset name)',
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
        tool: 'search_statcan',
        query: '',
        error: 'No search query provided. Please specify search terms.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);

  // Live search via API server
  const result = await searchGovData(query, 'all', limit);
  return {
    content: {
      tool: 'search_statcan',
      query,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
