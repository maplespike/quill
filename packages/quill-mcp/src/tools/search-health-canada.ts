// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_health_canada',
  description:
    'Search Health Canada data — drug approvals, product recalls, health product safety alerts, ' +
    'natural health product licensing, medical device recalls, and Health Canada regulatory ' +
    'decisions. More specific than the general health search.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — drug name, product, recall type, or regulation (e.g., "drug recall", "hand sanitizer", "medical device licence")',
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
    return { content: { tool: 'search_health_canada', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(`health canada ${query}`, limit);
    return { content: { tool: 'search_health_canada', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_health_canada', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
