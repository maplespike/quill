// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchGazette } from './upstream-fetcher.js';
import { applySourcePolicy } from '@maplespike/pipeline-core';

/**
 * Search the Canada Gazette — official newspaper of the Government of Canada
 * publishing proposed regulations, enacted laws, and government notices.
 *
 * Licence policy: federal law reproductions must be accurate and must never be
 * presented as an official version (Reproduction of Federal Law Order,
 * SI/97-5). Results pass through applySourcePolicy('gazette', …) and carry the
 * notice. Regression tests: src/__tests__/source-policy-gazette.test.ts.
 */
export const definition: ToolDefinition = {
  name: 'search_gazette',
  description:
    'Search the Canada Gazette — the official newspaper of the Government of Canada. ' +
    'Covers Part I (notices, proposed regulations), Part II (enacted regulations), ' +
    'and Part III (Acts of Parliament). Includes Regulatory Impact Analysis Statements ' +
    '(RIAS) with department attribution and effective dates.',
  descriptions: {
    "fr-CA": "Rechercher les règlements proposés et définitifs dans la Gazette du Canada (Parties I et II). Retourne les détails des règlements, les analyses d’impact et les ministères responsables. Couvre tous les ministères et organismes fédéraux.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms (e.g., "carbon pricing", "gun control", "telecommunications")',
      },
      part: {
        type: 'string',
        enum: ['part1', 'part2', 'part3', 'all'],
        description: 'Gazette part filter (default: all)',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum results to return (default: 10)',
      },
      lang: {
        type: 'string',
        enum: ['en', 'fr'],
        description: 'Language for Gazette feed (uses French -fra.xml RSS when fr). Default: en',
      },
    },
    required: ['query'],
  },
};

/** Core search — injectable fetcher for tests; applies the not-official-version policy. */
export async function runSearchGazette(
  args: { query: string; part?: string; limit?: number; lang?: string },
  fetchFn: typeof fetchGazette = fetchGazette,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = args.query;
  if (!query.trim()) {
    return {
      content: {
        tool: 'search_gazette',
        query: '',
        error: 'No search query provided. Please specify regulation search terms.',
      },
      isError: true,
    };
  }

  const part = args.part ?? 'all';
  const limit = Math.min(args.limit ?? 10, 50);
  const lang = args.lang ?? 'en';

  // Live search via API server
  const result = await fetchFn(query, limit, lang);
  const results = result.results;

  // Apply part filter if provided
  let filteredResults = results;
  if (part !== 'all') {
    const p = part.toLowerCase().replace(/\s+/g, '');
    filteredResults = results.filter((r: any) =>
      (r.part || '').toLowerCase().replace(/\s+/g, '').includes(p) ||
      JSON.stringify(r).toLowerCase().includes(p)
    );
  }

  const applied = applySourcePolicy('gazette', filteredResults);

  return {
    content: {
      tool: 'search_gazette',
      query,
      part,
      limit,
      results: applied.records,
      totalCount: part !== 'all' ? applied.records.length : result.total,
      policy: applied.policy,
    },
  };
}

/** Shared runner for the Part I/II/III convenience tools. */
export async function runGazettePart(
  partLabel: string,
  args: { query: string; limit?: number },
  fetchFn: typeof fetchGazette = fetchGazette,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = String(args.query ?? '').trim();
  const limit = Math.min((args.limit as number) ?? 10, 50);
  if (!query) return { content: { tool: `search_gazette_${partLabel}`, error: 'No query' }, isError: true };
  try {
    const { results, total } = await fetchFn(query, limit);
    const applied = applySourcePolicy('gazette', results);
    return {
      content: {
        tool: `search_gazette_${partLabel}`,
        query,
        results: applied.records,
        totalCount: total,
        policy: applied.policy,
      },
    };
  } catch (error) {
    return { content: { tool: `search_gazette_${partLabel}`, error: (error as Error).message }, isError: true };
  }
}

export const handler: ToolHandler = async (args) => {
  return runSearchGazette({
    query: (args.query as string) ?? '',
    part: (args.part as string) ?? 'all',
    limit: (args.limit as number) ?? 10,
    lang: (args.lang as string) ?? 'en',
  });
};
