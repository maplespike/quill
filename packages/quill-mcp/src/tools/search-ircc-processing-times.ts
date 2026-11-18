// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_ircc_processing_times',
  description:
    'Search IRCC (Immigration, Refugees and Citizenship Canada) application processing times ' +
    'by visa office and application type. Covers permanent residence, temporary residence, ' +
    'and citizenship application processing timelines.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — application type, visa office, or country (e.g., "spousal sponsorship", "study permit India", "citizenship")',
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
    return { content: { tool: 'search_ircc_processing_times', query: '', error: 'No search query provided. Try an application type or visa office.' }, isError: true };
  }
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_ircc_processing_times', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_ircc_processing_times', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
