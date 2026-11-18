// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_ircc_express_entry',
  description:
    'Search IRCC Express Entry rounds — CRS score cutoffs, invitations issued, and program-specific draws. ' +
    'Covers Canadian Experience Class, Federal Skilled Worker, Provincial Nominee, and category-based draws.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — program, CRS score, or date (e.g., "CEC draw 2024", "CRS 500", "category-based healthcare")',
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
    return { content: { tool: 'search_ircc_express_entry', query: '', error: 'No search query provided. Try a program, CRS score, or date.' }, isError: true };
  }
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_ircc_express_entry', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_ircc_express_entry', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
