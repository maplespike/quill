// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

/**
 * Search IRCC — Citizenship grants by province, demographic, and year.
 */
export const definition: ToolDefinition = {
  name: 'search_ircc-citizenship',
  description:
    'Search IRCC citizenship grants data including breakdowns by province, demographic groups, ' +
    'and year. Tracks permanent resident admissions that have been granted Canadian citizenship.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms (e.g., province name, demographic group, year, specific statistics)',
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
        tool: 'search_ircc-citizenship',
        query: '',
        error: 'No search query provided. Please specify search terms.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);

  // Live search via API server
  const result = await searchCkan(query, limit);
  return {
    content: {
      tool: 'search_ircc-citizenship',
      query,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
