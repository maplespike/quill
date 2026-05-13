import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords, getPipelineData, liveFetch } from './pipeline-data.js';

/**
 * Search independent oversight bodies — OAG (Auditor General), PBO (Budget Officer),
 * Ethics Commissioner, Lobbying Commissioner, Competition Bureau, CRTC.
 */
export const definition: ToolDefinition = {
  name: 'search_oversight',
  description:
    'Search independent oversight body reports, investigations, and decisions. ' +
    'Covers the Office of the Auditor General (OAG), Parliamentary Budget Officer (PBO), ' +
    'Office of the Conflict of Interest and Ethics Commissioner (CIEC), ' +
    'Office of the Lobbying Commissioner (OCL), Competition Bureau, and CRTC. ' +
    'Returns report findings, recommendations, investigation outcomes, and merger reviews.',
  descriptions: {
    "fr-CA": "Rechercher les rapports et enquêtes des organismes de surveillance fédéraux : Bureau du vérificateur général, directeur parlementaire du budget, commissaire à l’éthique, commissaire au lobbying, Bureau de la concurrence et CRTC.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — topic, body, or keyword (e.g., "cybersecurity", "phoenix pay", "Competition Bureau")',
      },
      body: {
        type: 'string',
        enum: ['oag', 'pbo', 'ethics', 'lobbying', 'competition', 'crtc', 'all'],
        description: 'Oversight body filter (default: all)',
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

// Map oversight body param to the body field values in pipeline data
const bodyFilterMap: Record<string, string> = {
  oag: 'OAG',
  pbo: 'PBO',
  ethics: 'CIEC',
  lobbying: 'OCL',
  competition: 'Competition Bureau',
  crtc: 'CRTC',
};

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  if (!query.trim()) {
    return {
      content: {
        tool: 'search_oversight',
        query: '',
        error: 'No search query provided. Please specify a topic, body, or keyword to search.',
      },
      isError: true,
    };
  }

  const body = (args.body as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  // Try cached pipeline data first; fall back to live fetch if unavailable
  let results: any[];
  let total: number;
  if (getPipelineData()) {
    const result = searchRecords(['oversight'], query, limit);
    results = result.results;
    total = result.total;
  } else {
    const liveResult = await liveFetch(['oversight'], query, limit);
    results = liveResult.results;
    total = liveResult.total;
  }

  // Apply body filter if provided
  let filteredResults = results;
  if (body !== 'all') {
    const bodyValue = bodyFilterMap[body] || '';
    if (bodyValue) {
      filteredResults = results.filter((r: any) =>
        (r.body || '').toLowerCase() === bodyValue.toLowerCase()
      );
    }
  }

  return {
    content: {
      tool: 'search_oversight',
      query,
      body,
      limit,
      results: filteredResults,
      totalCount: body !== 'all' ? filteredResults.length : total,
    },
  };
};
