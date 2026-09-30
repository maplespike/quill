import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchCommittees } from './upstream-fetcher.js';

/**
 * Search available House of Commons and Senate committee records returned by configured sources.
 * Coverage and fields vary; in-camera designations do not disclose non-public discussions.
 */
export const definition: ToolDefinition = {
  name: 'search_committees',
  description:
    'Search available House of Commons and Senate committee records returned by configured sources. ' +
    'Coverage and fields vary. In-camera designations may appear when reported by a source; they do not disclose non-public discussions.',
  descriptions: {
    "fr-CA": "Rechercher les dossiers disponibles des comités de la Chambre des communes et du Sénat dans les sources configurées. La couverture varie. Les désignations de huis clos n'exposent pas les discussions non publiques.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
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

  let results: Record<string, unknown>[];
  let total: number;
  try {
    const result = await fetchCommittees(query, limit);
    results = result.results;
    total = result.total;
  } catch {
    return {
      content: {
        tool: 'search_committees',
        query,
        chamber,
        committee: committeeCode || undefined,
        limit,
        results: [],
        totalCount: 0,
        error: 'Search temporarily unavailable. The API server may be unreachable.',
      },
      isError: true,
    };
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
