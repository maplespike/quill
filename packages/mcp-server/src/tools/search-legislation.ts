import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_legislation',
  description:
    'Search Canadian federal and provincial legislation — Acts of Parliament, regulations, ' +
    'bills, and statutory instruments from Justice Canada consolidated laws and provincial ' +
    'legislation databases including Ontario e-Laws, BC Laws, and Quebec legislation.',
  descriptions: {
    'fr-CA': 'Rechercher la législation canadienne fédérale et provinciale — lois du Parlement, règlements, projets de loi et instruments statutaires.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — act name, bill number, regulation, or legal topic (e.g., "Privacy Act", "Bill C-27", "environmental assessment regulation")',
      },
      jurisdiction: {
        type: 'string',
        enum: ['federal', 'ontario', 'bc', 'quebec', 'all'],
        description: 'Jurisdiction filter (default: all)',
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
        tool: 'search_legislation',
        query: '',
        error: 'No search query provided. Specify an act name, bill number, or legal topic.',
      },
      isError: true,
    };
  }

  const jurisdiction = (args.jurisdiction as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const searchJurisdiction = jurisdiction === 'all' ? 'federal' : jurisdiction;
  const result = await searchGovData(`legislation act bill regulation ${query}`, searchJurisdiction, limit);

  return {
    content: {
      tool: 'search_legislation',
      query,
      jurisdiction,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
