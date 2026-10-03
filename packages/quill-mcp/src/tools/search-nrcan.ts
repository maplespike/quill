import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_nrcan',
  description:
    'Search Natural Resources Canada (NRCan) data — mining activities, topographic maps, ' +
    'energy statistics, forest inventory, renewable energy, and mineral production. ' +
    'Covers the NRCan sub-modules this tool is configured to reach, including energy, ' +
    'mining, forestry, and geospatial data; coverage depends on which upstream catalogues respond.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — commodity, region, or resource type (e.g., "lithium Quebec", "forest biomass", "renewable energy capacity")',
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
    return { content: { tool: 'search_nrcan', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_nrcan', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_nrcan', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
