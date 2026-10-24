// SPDX-License-Identifier: AGPL-3.0-only
import type {ToolDefinition,ToolHandler} from './types.js';
import { searchCkan } from './upstream-fetcher.js';
export const definition: ToolDefinition = {
  name: 'search_federal_grants',
  description: 'Search federal grants and contributions data. Results from open.canada.ca.',
  inputSchema: { type: 'object', properties: {
    query: { type: 'string', maxLength: 2000, description: 'Search terms' },
    limit: { type: 'number', minimum: 1, maximum: 50 },
  }, required: ['query'] },
};
export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '').trim();
  const limit = Math.min((args.limit as number) ?? 10, 50);
  if (!query) return { content: { tool: 'search_federal_grants', error: 'No query' }, isError: true };
  try {
    const { results, total } = await searchCkan(query + ' federal grants', limit);
    return { content: { tool: 'search_federal_grants', query, results, totalCount: total } };
  } catch (error) {
    return { content: { tool: 'search_federal_grants', error: (error as Error).message }, isError: true };
  }
};
