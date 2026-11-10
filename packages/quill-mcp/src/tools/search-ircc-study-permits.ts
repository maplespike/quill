// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_ircc_study_permits',
  description:
    'Search IRCC study permit holder data by institution, province, country, and year. ' +
    'Covers international student enrollment, designated learning institutions, and study permit holders ' +
    'across Canadian provinces and territories.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — institution, province, or country (e.g., "University of Toronto", "Ontario international students", "India")',
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
    return { content: { tool: 'search_ircc_study_permits', query: '', error: 'No search query provided. Try an institution, province, or country.' }, isError: true };
  }
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_ircc_study_permits', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_ircc_study_permits', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
