import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';
import { fetchJson } from './upstream-fetcher.js';

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

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Number(args.limit ?? 20);
  const lang = (args.lang as string) ?? 'en';
  if (!query.trim()) {
    return { content: { tool: 'search_legislation', query: '', error: 'No search query provided. Try an act name, keyword, or jurisdiction.' }, isError: true };
  }
  try {
    if (lang === 'fr') {
      // Search French legislation via Justice Canada
      try {
        const frResult = await fetchJson<{ results: Record<string, unknown>[]; total: number }>(
          `https://laws-lois.justice.gc.ca/api/search?query=${encodeURIComponent(query)}&language=fr&maxResults=${limit}`,
          10000,
        );
        if (frResult?.results?.length) {
          return { content: { tool: 'search_legislation', query, limit, lang: 'fr', source: 'https://lois.justice.gc.ca/fra/', results: frResult.results, totalCount: frResult.total } };
        }
      } catch {
        // Fall through to CKAN
      }
    }
    const result = await searchCkan(query, limit, lang);
    return { content: { tool: 'search_legislation', query, limit, lang, ...result } };
  } catch (err) {
    return { content: { tool: 'search_legislation', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
