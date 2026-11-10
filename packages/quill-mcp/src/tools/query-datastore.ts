// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { crossQuery, datastoreStats, storeResult } from './datastore.js';

export const definition: ToolDefinition = {
  name: 'datastore_query',
  description:
    'Query the cross-module datastore — search previously fetched results across tools. ' +
    'Useful for combining data from multiple Quill tools (e.g., committees + lobbying + procurement). ' +
    'Results are cached with TTL; expired entries are auto-cleaned.',
  inputSchema: {
    type: 'object',
    properties: {
      tools: {
        type: 'string',
        maxLength: 500,
description: 'Comma-separated tool names to filter by (e.g., "search_committees,search_influence"). Empty for all.',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 50)',
      },
    },
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const toolsStr = String(args.tools ?? '');
  const limit = Number(args.limit ?? 50);
  const toolFilter = toolsStr ? toolsStr.split(',').map(t => t.trim()) : [];

  const results = await crossQuery(toolFilter);

  return {
    content: {
      tool: 'datastore_query',
      tools: toolFilter,
      results: results.slice(0, limit).map(r => ({
        tool: r.tool,
        query_key: r.queryKey,
        saved_at: r.savedAt,
        ttl_hours: r.ttl,
        data: r.data,
      })),
      total: results.length,
      stats: await datastoreStats(),
    },
  };
};

export const statsDefinition: ToolDefinition = {
  name: 'datastore_stats',
  description: 'Get datastore statistics — entry counts per tool, total size, expiry info.',
  inputSchema: { type: 'object', properties: {} },
};

export const statsHandler: ToolHandler = async () => {
  const stats = await datastoreStats();
  return { content: { tool: 'datastore_stats', ...stats } };
};
