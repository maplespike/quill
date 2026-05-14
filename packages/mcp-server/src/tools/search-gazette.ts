import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

/**
 * Search the Canada Gazette — official newspaper of the Government of Canada
 * publishing proposed regulations, enacted laws, and government notices.
 */
export const definition: ToolDefinition = {
  name: 'search_gazette',
  description:
    'Search the Canada Gazette — the official newspaper of the Government of Canada. ' +
    'Covers Part I (notices, proposed regulations), Part II (enacted regulations), ' +
    'and Part III (Acts of Parliament). Includes Regulatory Impact Analysis Statements ' +
    '(RIAS) with department attribution and effective dates.',
  descriptions: {
    "fr-CA": "Rechercher les règlements proposés et définitifs dans la Gazette du Canada (Parties I et II). Retourne les détails des règlements, les analyses d’impact et les ministères responsables. Couvre tous les ministères et organismes fédéraux.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms (e.g., "carbon pricing", "gun control", "telecommunications")',
      },
      part: {
        type: 'string',
        enum: ['part1', 'part2', 'part3', 'all'],
        description: 'Gazette part filter (default: all)',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum results to return (default: 10)',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  if (!query.trim()) {
    return {
      content: {
        tool: 'search_gazette',
        query: '',
        error: 'No search query provided. Please specify regulation search terms.',
      },
      isError: true,
    };
  }

  const part = (args.part as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  // Live search via API server
  const result = await searchGovData(query, 'all', limit);
  let results = result.results;
  let total = result.total;

  // Apply part filter if provided
  let filteredResults = results;
  if (part !== 'all') {
    const p = part.toLowerCase().replace(/\s+/g, '');
    filteredResults = results.filter((r: any) =>
      (r.part || '').toLowerCase().replace(/\s+/g, '').includes(p) ||
      JSON.stringify(r).toLowerCase().includes(p)
    );
  }

  return {
    content: {
      tool: 'search_gazette',
      query,
      part,
      limit,
      results: filteredResults,
      totalCount: part !== 'all' ? filteredResults.length : total,
    },
  };
};
