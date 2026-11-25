import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchCorporate } from './upstream-fetcher.js';
import { applySourcePolicy } from '@maplespike/pipeline-core';

/**
 * Search corporate registry data, federal lobbying records, procurement contracts,
 * and executive statements from Canadian companies.
 */
export const definition: ToolDefinition = {
  name: 'search_corporate',
  description:
    'Search Canadian corporate registry data, federal procurement contracts, ' +
    'lobbying registrations, and executive statements. Tracks insider transactions, ' +
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

function corporatePolicyId(dataset: string): string {
  if (dataset === 'lobbying') return 'federal-lobbying-monthly';
  if (dataset === 'statements') return 'media-broadcasting';
  return 'corporate';
}

/** Mixed corporate results: each record type keeps its own policy. */
function projectMixedCorporateRecord(record: Record<string, unknown>): unknown {
  if (
    'registrant_address' in record
    || 'registrantAddress' in record
    || 'registrant_name' in record
    || 'registrantName' in record
  ) {
    return applySourcePolicy('federal-lobbying-monthly', [record]).records[0];
  }
  if ('executiveName' in record || 'statementType' in record) {
    return applySourcePolicy('media-broadcasting', [record]).records[0];
  }
  if ('insiderName' in record || 'insider_name' in record) {
    return applySourcePolicy('sedi', [record]).records[0];
  }
  return record;
}

/** Core search — injectable fetcher for tests. Record type selects the policy. */
export async function runSearchCorporate(
  args: { query?: string; dataset?: string; limit?: number },
  fetchFn: typeof fetchCorporate = fetchCorporate,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = args.query ?? '';
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

  const dataset = args.dataset ?? 'all';
  const limit = Math.min(args.limit ?? 10, 50);

  const sourceKeys = datasetSourceMap[dataset] || datasetSourceMap.all;

  let results: Record<string, unknown>[];
  let total: number;
  try {
    const result = await fetchFn(query, limit);
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

  const prepared = dataset === 'all' ? results.map(projectMixedCorporateRecord) : results;
  const applied = applySourcePolicy(corporatePolicyId(dataset), prepared);

  return {
    content: {
      tool: 'search_corporate',
      query,
      dataset,
      limit,
      results: applied.records,
      totalCount: total,
      policy: applied.policy,
    },
  };
}

export const handler: ToolHandler = async (args) => {
  return runSearchCorporate({
    query: args.query as string | undefined,
    dataset: args.dataset as string | undefined,
    limit: args.limit as number | undefined,
  });
};
