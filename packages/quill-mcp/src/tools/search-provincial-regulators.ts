// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_provincial_regulators',
  description:
    'Search Canadian provincial regulatory bodies data — securities commissions, law societies, ' +
    'police oversight, engineering regulators, medical colleges, and other professional regulators ' +
    'listed in the curated regulator index this tool queries. ' +
    'The index is a finite list, not a registry of every Canadian regulator.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — regulator name, profession, or province (e.g., "Ontario Securities Commission", "engineering regulator Alberta", "law society")',
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
  if (!query.trim()) return { content: { tool: 'search_provincial_regulators', query: '', error: 'No search query provided.' }, isError: true };
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_provincial_regulators', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_provincial_regulators', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
