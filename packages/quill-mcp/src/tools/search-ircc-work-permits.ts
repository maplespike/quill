// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_ircc_work_permits',
  description:
    'Search IRCC work permit holder data by NOC code, province, country, and year. ' +
    'Covers temporary foreign workers, international mobility program participants, ' +
    'and post-graduation work permit holders.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — NOC code, province, or country (e.g., "software engineers Ontario", "TFWP agriculture", "NOC 21231")',
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
    return { content: { tool: 'search_ircc_work_permits', query: '', error: 'No search query provided. Try a NOC code, province, or country.' }, isError: true };
  }
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_ircc_work_permits', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_ircc_work_permits', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
