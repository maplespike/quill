import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';
import { fetchJson } from './upstream-fetcher.js';
import { applySourcePolicy } from '@maplespike/pipeline-core';

/**
 * Search Canadian legislation — Justice Canada consolidated federal laws,
 * provincial legislation, and regulatory data.
 *
 * Licence policy: federal law reproductions must be accurate and must never be
 * presented as an official version (Reproduction of Federal Law Order,
 * SI/97-5). Results pass through applySourcePolicy('legislation', …).
 * Regression tests: src/__tests__/source-policy-gazette.test.ts.
 */
export const definition: ToolDefinition = {
  name: 'search_legislation',
  description:
    'Search Canadian legislation — Justice Canada consolidated federal laws, provincial legislation, ' +
    'and regulatory data. Covers federal acts, regulations, and provincial statutes from Ontario e-Laws, BC Laws, and Quebec legislation. ' +
    'Set lang=fr to search lois.justice.gc.ca/fra/ for French-language federal legislation.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — act name, keyword, or jurisdiction (e.g., "Canada Elections Act", "carbon tax", "privacy law")',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 20)',
      },
      lang: {
        type: 'string',
        enum: ['en', 'fr'],
        description: 'Language. When fr, searches lois.justice.gc.ca/fra/ for French legislation. Default: en',
      },
    },
    required: ['query'],
  },
};

/** Core search — injectable fetchers for tests; applies the not-official-version policy. */
export async function runSearchLegislation(
  args: { query: string; limit?: number; lang?: string },
  deps: { fetchJsonFn?: typeof fetchJson; searchCkanFn?: typeof searchCkan } = {},
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const fetchJsonFn = deps.fetchJsonFn ?? fetchJson;
  const searchCkanFn = deps.searchCkanFn ?? searchCkan;

  const query = args.query;
  const limit = Number(args.limit ?? 20);
  const lang = args.lang ?? 'en';
  if (!query.trim()) {
    return {
      content: {
        tool: 'search_legislation',
        query: '',
        error: 'No search query provided. Try an act name, keyword, or jurisdiction.',
      },
      isError: true,
    };
  }
  try {
    if (lang === 'fr') {
      // Search French legislation via Justice Canada
      try {
        const frResult = await fetchJsonFn<{ results: Record<string, unknown>[]; total: number }>(
          `https://laws-lois.justice.gc.ca/api/search?query=${encodeURIComponent(query)}&language=fr&maxResults=${limit}`,
          10000,
        );
        if (frResult?.results?.length) {
          const applied = applySourcePolicy('legislation', frResult.results);
          return {
            content: {
              tool: 'search_legislation',
              query,
              limit,
              lang: 'fr',
              source: 'https://lois.justice.gc.ca/fra/',
              results: applied.records,
              totalCount: frResult.total,
              policy: applied.policy,
            },
          };
        }
      } catch {
        // Fall through to CKAN
      }
    }
    const result = await searchCkanFn(query, limit, lang);
    const applied = applySourcePolicy('legislation', result.results);
    return {
      content: {
        tool: 'search_legislation',
        query,
        limit,
        lang,
        results: applied.records,
        total: result.total,
        policy: applied.policy,
      },
    };
  } catch (err) {
    return { content: { tool: 'search_legislation', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
}

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  return runSearchLegislation({
    query: String(args.query ?? ''),
    limit: (args.limit as number) ?? 20,
    lang: (args.lang as string) ?? 'en',
  });
};
