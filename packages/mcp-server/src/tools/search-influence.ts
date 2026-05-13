import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords, getPipelineData, liveFetch } from './pipeline-data.js';

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
  descriptions: {
    "fr-CA": "Rechercher des acteurs d’influence suivis par MapleSpike — 32 organisations internationales, groupes de réflexion, cabinets de conseil et ONG. Retourne le financement gouvernemental, les comparaîtons devant les comités, les données d’organisme de bienfaisance de l’ARC et les connexions transversales.",
  },
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

  // Try cached pipeline data first; fall back to live fetch if unavailable
  let results: any[];
  let total: number;
  if (getPipelineData()) {
    const result = searchRecords(['influence'], query, limit);
    results = result.results;
    total = result.total;
  } else {
    const liveResult = await liveFetch(['influence'], query, limit);
    results = liveResult.results;
    total = liveResult.total;
  }

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
