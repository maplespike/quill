import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchCorporate } from './upstream-fetcher.js';

/**
 * Search corporate registry data, federal lobbying records, procurement contracts,
 * and executive statements from Canadian companies.
 */
export const definition: ToolDefinition = {
  name: 'search_corporate',
  description:
    'Search Canadian corporate registry data, federal procurement contracts, ' +
    'lobbying registrations, and executive statements. Tracks ' +
    'sole-source contracts, company press releases, and corporate-government interactions. ' +
    'Cross-references with federal lobbying registry and proactive disclosure data.',
  descriptions: {
    "fr-CA": "Rechercher dans les registres de lobbying fédéraux, les données d’approvisionnement et les déclarations de dirigeants d’entreprises. Couvre les 17 dirigeants suivis dans les secteurs bancaire, des télécommunications et des médias. Retourne les activités de lobbying, les attributions de contrats et les déclarations publiques.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — company name, executive name, or keyword (e.g., "Google", "sole source", "lobbying")',
      },
      dataset: {
        type: 'string',
        enum: ['lobbying', 'procurement', 'statements', 'all'],
        description: 'Corporate dataset to search (default: all)',
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

// Map dataset param to pipeline source keys
const datasetSourceMap: Record<string, string[]> = {
  lobbying: ['lobbying'],
  procurement: ['procurement'],
  statements: ['corporate'],
  all: ['corporate', 'lobbying', 'procurement'],
};

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  if (!query.trim()) {
    return {
      content: {
        tool: 'search_corporate',
        query: '',
        error: 'No search query provided. Please specify a company name, executive, or keyword.',
      },
      isError: true,
    };
  }

  const dataset = (args.dataset as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const sourceKeys = datasetSourceMap[dataset] || datasetSourceMap.all;

  let results: Record<string, unknown>[];
  let total: number;
  try {
    const result = await fetchCorporate(query, limit);
    results = result.results;
    total = result.total;
  } catch {
    return {
      content: {
        tool: 'search_corporate',
        query,
        dataset,
        limit,
        results: [],
        totalCount: 0,
        error: 'Search temporarily unavailable. The API server may be unreachable.',
      },
      isError: true,
    };
  }

  return {
    content: {
      tool: 'search_corporate',
      query,
      dataset,
      limit,
      results,
      totalCount: total,
    },
  };
};
