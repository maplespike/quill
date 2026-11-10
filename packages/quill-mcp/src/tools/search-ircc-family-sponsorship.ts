// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_ircc_family_sponsorship',
  description:
    'Search IRCC family sponsorship statistics by visa office, category, and year. ' +
    'Covers spousal, partner, dependent child, parent and grandparent sponsorship applications and approvals.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — visa office, category, or year (e.g., "parent sponsorship", "spousal sponsorship Manila", "PGP 2024")',
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
    return { content: { tool: 'search_ircc_family_sponsorship', query: '', error: 'No search query provided. Try a visa office, category, or year.' }, isError: true };
  }
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_ircc_family_sponsorship', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_ircc_family_sponsorship', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
