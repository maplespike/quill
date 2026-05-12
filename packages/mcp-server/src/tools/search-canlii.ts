import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords } from './pipeline-data.js';

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

  const { results, total } = searchRecords(['canlii'], query, limit);

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
    },
  };
};
