import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords, getPipelineData, liveFetch } from './pipeline-data.js';

/**
 * Search House of Commons and Senate committee evidence, transcripts, and proceedings.
 * Covers standing committees, special committees, joint committees, and in-camera meetings.
 */
export const definition: ToolDefinition = {
  name: 'search_committees',
  description:
    'Search House of Commons and Senate committee evidence, meeting transcripts, and proceedings. ' +
    'Covers standing committees (e.g., FINA, OGGO, ETHI), special committees, joint committees, ' +
    'and in-camera (secret) meeting records. Returns witness testimony, interventions, and ' +
    'speaker attributions with timestamps.',
  descriptions: {
    "fr-CA": "Rechercher des témoignages, transcriptions et procès-verbaux de comités de la Chambre des communes et du Sénat. Couvre les comités permanents (p. ex., FINA, OGGO, ETHI), les comités spéciaux, les comités mixtes et les séances à huis clos. Retourne les témoignages, interventions et attributions de temps de parole.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms (e.g., "carbon tax", "arrivecan", "foreign interference")',
      },
      chamber: {
        type: 'string',
        enum: ['house', 'senate', 'joint', 'all'],
        description: 'Parliamentary chamber filter (default: all)',
      },
      committee: {
        type: 'string',
        description: 'Specific committee code (e.g., "FINA", "OGGO", "ETHI", "SOCI")',
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
        tool: 'search_committees',
        query: '',
        error: 'No search query provided. Please specify search terms (e.g., "carbon tax", "arrivecan").',
      },
      isError: true,
    };
  }

  const chamber = (args.chamber as string) ?? 'all';
  const committeeCode = (args.committee as string) ?? '';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  // Map chamber filter to source keys
  let sourceKeys: string[] = [];
  if (chamber === 'house' || chamber === 'all') sourceKeys.push('hoc');
  if (chamber === 'senate' || chamber === 'all') sourceKeys.push('senate');

  // Try cached pipeline data first; fall back to live fetch if unavailable
  let results: any[];
  let total: number;
  if (getPipelineData()) {
    const result = searchRecords(sourceKeys, query, limit);
    results = result.results;
    total = result.total;
  } else {
    const liveResult = await liveFetch(sourceKeys, query, limit);
    results = liveResult.results;
    total = liveResult.total;
  }

  // Apply committee filter post-search
  let filteredResults = results;
  if (committeeCode) {
    const cc = committeeCode.toLowerCase();
    filteredResults = results.filter((r: any) =>
      (r.committee || '').toLowerCase().includes(cc) ||
      (r.name || '').toLowerCase().includes(cc)
    );
  }

  return {
    content: {
      tool: 'search_committees',
      query,
      chamber,
      committee: committeeCode || undefined,
      limit,
      results: filteredResults,
      totalCount: committeeCode ? filteredResults.length : total,
    },
  };
};
