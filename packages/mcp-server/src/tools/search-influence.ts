import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords } from './pipeline-data.js';

/**
 * Search influence tracking data — international organizations, NGOs, think tanks,
 * consultancies, and their government funding connections.
 */
export const definition: ToolDefinition = {
  name: 'search_influence',
  description:
    'Search influence tracking records including international organizations, NGOs, ' +
    'think tanks, and consultancies operating in Canada. Traces government funding flows, ' +
    'CRA charity status, grants data, and organizational connections. ' +
    'Cross-references with federal grant metadata and parliamentary committee oversight.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Organization name, person, or keyword (e.g., "McKinsey", "WE Charity", "climate NGO")',
      },
      category: {
        type: 'string',
        enum: ['international_organization', 'ngo', 'think_tank', 'consultancy', 'all'],
        description: 'Influence actor category filter (default: all)',
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
        tool: 'search_influence',
        query: '',
        error: 'No search query provided. Please specify an organization or keyword.',
      },
      isError: true,
    };
  }

  const category = (args.category as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const { results, total } = searchRecords(['influence'], query, limit);

  // Apply category filter if provided
  let filteredResults = results;
  if (category !== 'all') {
    const cat = category.toLowerCase().replace(/_/g, ' ');
    filteredResults = results.filter((r: any) =>
      JSON.stringify(r).toLowerCase().includes(cat)
    );
  }

  return {
    content: {
      tool: 'search_influence',
      query,
      category,
      limit,
      results: filteredResults,
      totalCount: category !== 'all' ? filteredResults.length : total,
    },
  };
};
