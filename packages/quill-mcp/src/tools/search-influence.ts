import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';
import { applySourcePolicy } from '@maplespike/pipeline-core';

/**
 * Search influence tracking data — international organizations, NGOs, think tanks,
 * consultancies, and their government funding connections.
 */
export const definition: ToolDefinition = {
  name: 'search_influence',
  description:
    'Search influence tracking records including international organizations, NGOs, ' +
    'think tanks, and consultancies operating in Canada. Traces government funding flows, ' +
    'CRA charity status, grants data, and organizational connections. ' +
    'Cross-references with federal grant metadata and parliamentary committee oversight.',
  descriptions: {
    "fr-CA": "Rechercher des acteurs d’influence suivis par MapleSpike — 32 organisations internationales, groupes de réflexion, cabinets de conseil et ONG. Retourne le financement gouvernemental, les comparaîtons devant les comités, les données d’organisme de bienfaisance de l’ARC et les connexions transversales.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Organization name, person, or keyword (e.g., "McKinsey", "WE Charity", "climate NGO")',
      },
      category: {
        type: 'string',
        enum: ['international_organization', 'ngo', 'think_tank', 'consultancy', 'all'],
        description: 'Influence actor category filter (default: all)',
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

/** Core search — injectable fetcher for tests. Influence records minimize personal information. */
export async function runSearchInfluence(
  args: { query?: string; category?: string; limit?: number },
  fetchFn: typeof searchCkan = searchCkan,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const query = args.query ?? '';
  if (!query.trim()) {
    return {
      content: {
        tool: 'search_influence',
        query: '',
        error: 'No search query provided. Please specify an organization or keyword.',
      },
      isError: true,
    };
  }

  const category = args.category ?? 'all';
  const limit = Math.min(args.limit ?? 10, 50);

  const result = await fetchFn(query, limit);
  const results = result.results;
  const total = result.total;

  // Apply category filter if provided
  let filteredResults = results;
  if (category !== 'all') {
    const cat = category.toLowerCase().replace(/_/g, ' ');
    filteredResults = results.filter((r: any) =>
      JSON.stringify(r).toLowerCase().includes(cat)
    );
  }

  const applied = applySourcePolicy('influence', filteredResults);

  return {
    content: {
      tool: 'search_influence',
      query,
      category,
      limit,
      results: applied.records,
      totalCount: category !== 'all' ? applied.records.length : total,
      policy: applied.policy,
    },
  };
}

export const handler: ToolHandler = async (args) => {
  return runSearchInfluence({
    query: args.query as string | undefined,
    category: args.category as string | undefined,
    limit: args.limit as number | undefined,
  });
};
