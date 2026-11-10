// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_real_time_feeds',
  description:
    'Search Canadian time-sensitive government data feeds — emergency alerts (CAP-CP), ' +
    'health advisories, urgent notices, and other urgent government communications. ' +
    'These feeds are polled, so a slow or unreachable feed yields no results rather than a delayed alert; ' +
    'for life-safety decisions consult the issuing authority directly.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — event type, location, or date (e.g., "tornado warning Alberta", "health advisory", "amber alert")',
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
  if (!query.trim()) return { content: { tool: 'search_real_time_feeds', query: '', error: 'No search query provided.' }, isError: true };
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_real_time_feeds', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_real_time_feeds', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
