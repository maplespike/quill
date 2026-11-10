// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchLmia } from './upstream-fetcher.js';

/**
 * Search Labour Market Impact Assessment (LMIA) data — ESDC quarterly statistics
 * on employer use of the Temporary Foreign Worker (TFW) program.
 */
export const definition: ToolDefinition = {
  name: 'search_lmia',
  description:
    'Search Labour Market Impact Assessment (LMIA) data from Employment and Social Development Canada (ESDC). ' +
    'Provides quarterly statistics on employer use of the Temporary Foreign Worker program, ' +
    'including approval/denial rates, streams (high-wage, low-wage, agriculture, etc.), ' +
    'occupations, provinces, and top employers. Cross-references with corporate data and ' +
    'procurement records to add context to a TFW program question; the cross-reference is ' +
    'name-based and does not establish a link between a company and a specific LMIA.',
  descriptions: {
    "fr-CA": "Rechercher les données trimestrielles sur les études d’impact sur le marché du travail (EIMT). Retourne les données par employeur, profession, province et résultats (approuvé/refusé). Utile pour le suivi du Programme des travailleurs étrangers temporaires.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — employer name, occupation, or NOC code (e.g., "Maple Leaf Foods", "software engineer")',
      },
      stream: {
        type: 'string',
        enum: ['high_wage', 'low_wage', 'agriculture', 'caregiver', 'all'],
        description: 'TFW stream filter (default: all)',
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
        tool: 'search_lmia',
        query: '',
        error: 'No search query provided. Please specify an employer, occupation, or NOC code.',
      },
      isError: true,
    };
  }

  const stream = (args.stream as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const result = await fetchLmia(query, limit);
  let results = result.results;
  let total = result.total;

  // Apply stream filter if provided
  let filteredResults = results;
  if (stream !== 'all') {
    const s = stream.toLowerCase().replace(/_/g, ' ');
    filteredResults = results.filter((r: any) =>
      (r.outcome || '').toLowerCase().includes(s) ||
      JSON.stringify(r).toLowerCase().includes(s)
    );
  }

  return {
    content: {
      tool: 'search_lmia',
      query,
      stream,
      limit,
      results: filteredResults,
      totalCount: stream !== 'all' ? filteredResults.length : total,
    },
  };
};
