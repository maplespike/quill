import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';
import { applySourcePolicy } from '@maplespike/pipeline-core';

/**
 * Search provincial lobbying registries across Canadian provinces.
 * Covers Ontario, British Columbia, Alberta, Quebec, and other provincial registries.
 *
 * Licence policy: lobbying records minimize personal contact details and are
 * not used to build cross-source person profiles — the registries' licences
 * do not grant personal-information rights. Results pass through
 * applySourcePolicy('provincial-lobbying', …). Regression tests:
 * src/__tests__/source-policy-pii.test.ts.
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
        maxLength: 2000,
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

/** Core search — injectable fetcher for tests; applies the source licence policy. */
export async function runSearchProvincialLobbying(
  args: { query: string; province?: string; limit?: number },
  fetchFn: typeof searchCkan = searchCkan,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = args.query;
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

  const province = args.province ?? 'all';
  const limit = Math.min(args.limit ?? 10, 50);

  const result = await fetchFn(query, limit);
  const results = result.results;

  // Apply province filter if provided
  let filteredResults = results;
  if (province !== 'all') {
    const provCode = provinceMap[province] || '';
    if (provCode) {
      filteredResults = results.filter(
        (r) => String(r.province ?? '').toLowerCase() === provCode.toLowerCase(),
      );
    }
  }

  const applied = applySourcePolicy('provincial-lobbying', filteredResults);

  return {
    content: {
      tool: 'search_provincial_lobbying',
      query,
      province,
      limit,
      results: applied.records,
      totalCount: province !== 'all' ? filteredResults.length : result.total,
      policy: applied.policy,
    },
  };
}

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  return runSearchProvincialLobbying({
    query,
    province: (args.province as string) ?? 'all',
    limit: (args.limit as number) ?? 10,
  });
};
