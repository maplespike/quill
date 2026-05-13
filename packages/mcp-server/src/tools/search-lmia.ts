import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords, getPipelineData, liveFetch } from './pipeline-data.js';

/**
 * Search Labour Market Impact Assessment (LMIA) data — ESDC quarterly statistics
 * on employer use of the Temporary Foreign Worker (TFW) program.
 */
export const definition: ToolDefinition = {
  name: 'search_lmia',
  description:
    'Search Labour Market Impact Assessment (LMIA) data from Employment and Social Development Canada (ESDC). ' +
    'Provides quarterly statistics on employer use of the Temporary Foreign Worker program, ' +
    'including approval/denial rates, streams (high-wage, low-wage, agriculture, etc.), ' +
    'occupations, provinces, and top employers. Cross-references with corporate data and ' +
    'procurement records for comprehensive TFW program oversight.',
  descriptions: {
    "fr-CA": "Rechercher les données trimestrielles sur les études d’impact sur le marché du travail (EIMT). Retourne les données par employeur, profession, province et résultats (approuvé/refusé). Utile pour le suivi du Programme des travailleurs étrangers temporaires.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — employer name, occupation, or NOC code (e.g., "Maple Leaf Foods", "software engineer")',
      },
      stream: {
        type: 'string',
        enum: ['high_wage', 'low_wage', 'agriculture', 'caregiver', 'all'],
        description: 'TFW stream filter (default: all)',
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
        tool: 'search_lmia',
        query: '',
        error: 'No search query provided. Please specify an employer, occupation, or NOC code.',
      },
      isError: true,
    };
  }

  const stream = (args.stream as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  // Try cached pipeline data first; fall back to live fetch if unavailable
  let results: any[];
  let total: number;
  if (getPipelineData()) {
    const result = searchRecords(['lmia'], query, limit);
    results = result.results;
    total = result.total;
  } else {
    const liveResult = await liveFetch(['lmia'], query, limit);
    results = liveResult.results;
    total = liveResult.total;
  }

  // Apply stream filter if provided
  let filteredResults = results;
  if (stream !== 'all') {
    const s = stream.toLowerCase().replace(/_/g, ' ');
    filteredResults = results.filter((r: any) =>
      (r.outcome || '').toLowerCase().includes(s) ||
      JSON.stringify(r).toLowerCase().includes(s)
    );
  }

  return {
    content: {
      tool: 'search_lmia',
      query,
      stream,
      limit,
      results: filteredResults,
      totalCount: stream !== 'all' ? filteredResults.length : total,
    },
  };
};
