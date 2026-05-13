import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords, getPipelineData, liveFetch } from './pipeline-data.js';

/**
 * Search provincial lobbying registries across Canadian provinces.
 * Covers Ontario, British Columbia, Alberta, Quebec, and other provincial registries.
 */
export const definition: ToolDefinition = {
  name: 'search_provincial_lobbying',
  description:
    'Search provincial lobbying registries across Canada. ' +
    'Covers Ontario, British Columbia, Alberta, Quebec, and other provincial lobbying records. ' +
    'Returns lobbying registrations, communication reports, and subject areas. ' +
    'Cross-references with the federal lobbying registry to identify multi-jurisdictional lobbying activity.',
  descriptions: {
    "fr-CA": "Rechercher les registres de lobbying provinciaux de l’Ontario. Normalise au schéma fédéral de lobbying pour une vue combinée fédérale-provinciale. Les registres de la C.-B. et du QC ne sont pas encore mis en œuvre.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — lobbyist name, organization, or subject (e.g., "Ontario Power Generation", "pharmacare")',
      },
      province: {
        type: 'string',
        enum: ['ontario', 'british-columbia', 'alberta', 'quebec', 'all'],
        description: 'Province filter (default: all)',
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

// Map province code to pipeline province field values
const provinceMap: Record<string, string> = {
  ontario: 'ON',
  'british-columbia': 'BC',
  alberta: 'AB',
  quebec: 'QC',
};

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  if (!query.trim()) {
    return {
      content: {
        tool: 'search_provincial_lobbying',
        query: '',
        error: 'No search query provided. Please specify a lobbyist, organization, or subject.',
      },
      isError: true,
    };
  }

  const province = (args.province as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  // Try cached pipeline data first; fall back to live fetch if unavailable
  let results: any[];
  let total: number;
  if (getPipelineData()) {
    const result = searchRecords(['provincialLobbying'], query, limit);
    results = result.results;
    total = result.total;
  } else {
    const liveResult = await liveFetch(['provincialLobbying'], query, limit);
    results = liveResult.results;
    total = liveResult.total;
  }

  // Apply province filter if provided
  let filteredResults = results;
  if (province !== 'all') {
    const provCode = provinceMap[province] || '';
    if (provCode) {
      filteredResults = results.filter((r: any) =>
        (r.province || '').toLowerCase() === provCode.toLowerCase()
      );
    }
  }

  return {
    content: {
      tool: 'search_provincial_lobbying',
      query,
      province,
      limit,
      results: filteredResults,
      totalCount: province !== 'all' ? filteredResults.length : total,
    },
  };
};
