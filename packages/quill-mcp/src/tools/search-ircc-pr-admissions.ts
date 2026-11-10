// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_ircc_pr_admissions',
  description:
    'Search IRCC permanent resident admissions by province, immigration category, and year. ' +
    'Covers economic immigrants, family class, refugees, and other PR admission categories ' +
    'for the provinces and territories IRCC reports, using the figures IRCC has published.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — province, category, or year (e.g., "Ontario economic immigrants 2024", "family class", "refugee admissions")',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 20)',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Number(args.limit ?? 20);
  if (!query.trim()) {
    return { content: { tool: 'search_ircc_pr_admissions', query: '', error: 'No search query provided. Try a province, category, or year.' }, isError: true };
  }
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_ircc_pr_admissions', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_ircc_pr_admissions', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
