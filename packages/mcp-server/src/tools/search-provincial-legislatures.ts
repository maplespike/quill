import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_provincial_legislatures',
  description:
    'Search provincial legislature data — Hansard transcripts, committee proceedings, and bills ' +
    'across all 10 Canadian provinces.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — province, topic, or member (e.g., "Ontario legislature budget debate", "BC Hansard housing")',
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
  if (!query.trim()) return { content: { tool: 'search_provincial_legislatures', query: '', error: 'No search query provided.' }, isError: true };
  try {
    const result = await searchGovData(query, 'all', limit);
    return { content: { tool: 'search_provincial_legislatures', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_provincial_legislatures', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
