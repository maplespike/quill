// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_a2aj',
  description:
    'Search A2J (Access to Justice) legal data — court decisions, case law coverage, ' +
    'and citation lookup across Canadian courts and tribunals. Result count is whatever the upstream ' +
    'A2J corpus holds and changes over time; Quill queries it rather than holding its own copy.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 500,
        description: 'Search terms — case name, citation, or legal topic (e.g., "Charter challenge", "2 SCR", "employment law")',
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
  if (!query.trim()) return { content: { tool: 'search_a2aj', query: '', error: 'No search query provided.' }, isError: true };
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_a2aj', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_a2aj', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
