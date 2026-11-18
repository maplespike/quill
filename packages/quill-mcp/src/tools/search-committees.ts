import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchCommittees } from './upstream-fetcher.js';
import { applySourcePolicy, presentParliamentaryToolResult, type ParliamentaryChamber } from '@maplespike/pipeline-core';

/**
 * Search available House of Commons and Senate committee records returned by configured sources.
 * Coverage and fields vary; in-camera designations do not disclose non-public discussions.
 *
 * Licence policy: committee content is discovery-only (the parliamentary
 * reproduction permissions exclude commercial use). Results pass through
 * applySourcePolicy('committees', …) — content bodies are stripped, summaries
 * are cut to a short excerpt, and the required notices ride with the policy
 * block. Regression tests: src/__tests__/source-policy-committees.test.ts.
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

/**
 * Core search — injectable fetcher for tests. Applies the discovery-only
 * licence policy to the results before they leave the tool.
 */
function chamberForFilter(chamber: string): ParliamentaryChamber {
  if (chamber === 'senate') return 'senate';
  if (chamber === 'house') return 'commons';
  return 'both';
}

export async function runSearchCommittees(
  args: { query: string; chamber?: string; committee?: string; limit?: number },
  fetchFn: typeof fetchCommittees = fetchCommittees,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = args.query ?? '';
  const chamber = args.chamber ?? 'all';
  const committeeCode = args.committee ?? '';
  const limit = Math.min(args.limit ?? 10, 50);

  let results: Record<string, unknown>[];
  let total: number;
  try {
    const result = await fetchFn(query, limit);
    results = result.results;
    total = result.total;
  } catch {
    return presentParliamentaryToolResult({
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
    }, { chamber: chamberForFilter(chamber) });
  }

  // Apply committee filter post-search
  let filteredResults = results;
  if (committeeCode) {
    const cc = committeeCode.toLowerCase();
    filteredResults = results.filter(
      (r) =>
        String(r.committee ?? '').toLowerCase().includes(cc) ||
        String(r.name ?? '').toLowerCase().includes(cc),
    );
  }

  const applied = applySourcePolicy('committees', filteredResults);

  return presentParliamentaryToolResult({
    content: {
      tool: 'search_committees',
      query,
      chamber,
      committee: committeeCode || undefined,
      limit,
      results: applied.records as Record<string, unknown>[],
      totalCount: committeeCode ? filteredResults.length : total,
      policy: applied.policy,
    },
  }, { chamber: chamberForFilter(chamber) });
}

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  if (!query.trim()) {
    return presentParliamentaryToolResult({
      content: {
        tool: 'search_committees',
        query: '',
        error: 'No search query provided. Please specify search terms (e.g., "carbon tax", "arrivecan").',
      },
      isError: true,
    }, { chamber: 'both' });
  }

  return runSearchCommittees({
    query,
    chamber: (args.chamber as string) ?? 'all',
    committee: (args.committee as string) ?? '',
    limit: (args.limit as number) ?? 10,
  });
};
