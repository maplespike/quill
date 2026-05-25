import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_municipal',
  description:
    'Search Canadian municipal government data — council meetings, agendas, decisions, budgets, ' +
    'and by-laws across major Canadian cities and regional authorities.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — city, topic, or department (e.g., "Toronto budget 2024", "Vancouver zoning", "Montreal transit")',
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
  if (!query.trim()) return { content: { tool: 'search_municipal', query: '', error: 'No search query provided.' }, isError: true };
  try {
    const result = await searchGovData(query, 'all', limit);
    return { content: { tool: 'search_municipal', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_municipal', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
