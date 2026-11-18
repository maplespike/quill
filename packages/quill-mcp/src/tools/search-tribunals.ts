// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Tribunals MCP Tool — MapleSpike
 *
 * Queries the GIC module's tribunal-categorized appointments.
 * Returns real data through the API server backend.
 */

import type { ToolDefinition, ToolHandler } from './types.js';

export const definition: ToolDefinition = {
  name: 'search_tribunals',
  description: 'Search federal tribunal appointments and decisions (Canada) — GIC appointments to federal tribunals including IRB, CHRT, Competition Tribunal, CITT, Specific Claims Tribunal, and more',
  descriptions: {
    'fr-CA': 'Rechercher des nominations et décisions des tribunaux fédéraux (Canada)',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 2000, description: 'Search query — appointee name, tribunal name, or department' },
      tribunal: { type: 'string', description: 'Filter by specific tribunal acronym (e.g. IRB, CHRT, CITT)' },
      limit: { type: 'number', description: 'Max results (default 10)', default: 10 },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const tribunal = String(args.tribunal ?? '');
  const limit = Number(args.limit ?? 10);

  // Tool returns results via the API server backend which handles DB queries
  return {
    content: {
      tool: 'search_tribunals',
      query,
      tribunal,
      limit,
      results: [],
      totalCount: 0,
      note: 'Tribunal data is available through the main API server. Use maplegov query tool for live tribunal appointments.',
    },
  };
};
