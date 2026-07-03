import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchCanlii } from './upstream-fetcher.js';

/**
 * Search CanLII (Canadian Legal Information Institute) court decisions.
 * Covers federal, provincial, and territorial court rulings with citation data.
 */
export const definition: ToolDefinition = {
  name: 'search_canlii',
  description:
    'Search Canadian court decisions via CanLII (Canadian Legal Information Institute). ' +
    'Covers Supreme Court of Canada, Federal Court, Federal Court of Appeal, ' +
    'provincial superior courts, and provincial appeal courts. Returns decision summaries, ' +
    'citations, party information, case history, and government relevance assessments. ' +
    'Tracks legislation citations and cross-references with tracked government departments.',
  descriptions: {
    "fr-CA": "Rechercher des décisions judiciaires canadiennes via CanLII. Couvre les cours fédérales et provinciales, y compris la Cour suprême, les cours d’appel et les cours supérieures. Retourne des extraits de décisions avec métadonnées et renvois.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — case name, party, citation, or keyword (e.g., "Charter s.7", "R. v.", "carbon tax")',
      },
      court: {
        type: 'string',
        description: 'Filter by court (e.g., "scc", "fca", "onca", "bcca")',
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
        description: 'Language for search results and French Court endpoint (rechercher.canlii.org). Default: en',
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
        tool: 'search_canlii',
        query: '',
        error: 'No search query provided. Please specify a case name, party, or legal keyword.',
      },
      isError: true,
    };
  }

  const court = (args.court as string) ?? '';
  const limit = Math.min((args.limit as number) ?? 10, 50);
  const lang = (args.lang as string) ?? 'en';

  const result = await fetchCanlii(query, limit, lang);
  let results = result.results;
  let total = result.total;

  // Apply court filter if provided
  let filteredResults = results;
  if (court) {
    const c = court.toLowerCase();
    filteredResults = results.filter((r: any) =>
      JSON.stringify(r).toLowerCase().includes(c)
    );
  }

  return {
    content: {
      tool: 'search_canlii',
      query,
      court: court || undefined,
      limit,
      results: filteredResults,
      totalCount: court ? filteredResults.length : total,
      source: 'CanLII — Canadian Legal Information Institute (https://www.canlii.org)',
      license: 'CanLII Terms of Use (https://www.canlii.org/en/info/terms.html)',
      attribution: 'Reproduced with permission from CanLII. Copyright © CanLII.',
    },
  };
};
