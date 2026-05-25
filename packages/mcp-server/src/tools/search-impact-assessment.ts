import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_impact_assessment',
  description:
    'Search Impact Assessment Agency of Canada (IAAC) federal project assessments — ' +
    'environmental impact statements, decisions, conditions, and timelines for major resource projects.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — project name, location, or sector (e.g., "Site C dam", "pipeline", "mining BC")',
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
    return { content: { tool: 'search_impact_assessment', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchGovData(query, 'all', limit);
    return { content: { tool: 'search_impact_assessment', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_impact_assessment', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
