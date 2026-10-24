// SPDX-License-Identifier: AGPL-3.0-only
import type {ToolDefinition,ToolHandler} from './types.js';
import { searchCkan } from './upstream-fetcher.js';
export const definition: ToolDefinition = {
  name: 'search_housing_data',
  description: 'Search housing and rental market data. Results from open.canada.ca.',
  inputSchema: { type: 'object', properties: {
    query: { type: 'string', maxLength: 2000, description: 'Search terms' },
    limit: { type: 'number', minimum: 1, maximum: 50 },
  }, required: ['query'] },
};
export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '').trim();
  const limit = Math.min((args.limit as number) ?? 10, 50);
  if (!query) return { content: { tool: 'search_housing_data', error: 'No query' }, isError: true };
  try {
    const { results, total } = await searchCkan(query + ' housing data', limit);
    return { content: { tool: 'search_housing_data', query, results, totalCount: total } };
  } catch (error) {
    return { content: { tool: 'search_housing_data', error: (error as Error).message }, isError: true };
  }
};
