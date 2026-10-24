// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { runGazettePart } from './search-gazette.js';
export const definition: ToolDefinition = {
  name: 'search_gazette_part3',
  description: 'Search Canada Gazette Part III. Returns items matching your query.',
  inputSchema: { type: 'object', properties: {
    query: { type: 'string', maxLength: 2000, description: 'Search terms' },
    limit: { type: 'number', minimum: 1, maximum: 50 },
  }, required: ['query'] },
};
export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  return runGazettePart('part3', {
    query: String(args.query ?? ''),
    limit: (args.limit as number) ?? 10,
  });
};
