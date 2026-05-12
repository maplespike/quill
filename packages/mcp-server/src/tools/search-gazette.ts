import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords } from './pipeline-data.js';

/**
 * Search the Canada Gazette — official newspaper of the Government of Canada
 * publishing proposed regulations, enacted laws, and government notices.
 */
export const definition: ToolDefinition = {
  name: 'search_gazette',
  description:
    'Search the Canada Gazette — the official newspaper of the Government of Canada. ' +
    'Covers Part I (notices, proposed regulations), Part II (enacted regulations), ' +
    'and Part III (Acts of Parliament). Includes Regulatory Impact Analysis Statements ' +
    '(RIAS) with department attribution and effective dates.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms (e.g., "carbon pricing", "gun control", "telecommunications")',
      },
      part: {
        type: 'string',
        enum: ['part1', 'part2', 'part3', 'all'],
        description: 'Gazette part filter (default: all)',
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
        tool: 'search_gazette',
        query: '',
        error: 'No search query provided. Please specify regulation search terms.',
      },
      isError: true,
    };
  }

  const part = (args.part as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const { results, total } = searchRecords(['gazette'], query, limit);

  return {
    content: {
      tool: 'search_gazette',
      query,
      part,
      limit,
      results,
      totalCount: total,
    },
  };
};
