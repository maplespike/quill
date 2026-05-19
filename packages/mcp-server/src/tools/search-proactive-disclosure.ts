import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_proactive_disclosure',
  description:
    'Search Canadian federal proactive disclosure data — contracts over $10K, ' +
    'travel expenses, hospitality expenses, reclassification actions, and wrongful dismissal settlements. ' +
    'Covers all federal departments and agencies publishing under the Open Government initiative.',
  descriptions: {
    'fr-CA': 'Rechercher des données sur la divulgation proactive fédérale — contrats de plus de 10 000 $, dépenses de voyage, dépenses d\'accueil, reclassements et règlements pour licenciement injustifié.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — vendor name, department, contract type, or expense category (e.g., "consulting contract Deloitte", "travel expenses DND", "hospitality TBS")',
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
        tool: 'search_proactive_disclosure',
        query: '',
        error: 'No search query provided. Specify a vendor, department, contract type, or expense category.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);

  const result = await searchGovData(`contract procurement travel hospitality expense ${query}`, 'federal', limit);

  return {
    content: {
      tool: 'search_proactive_disclosure',
      query,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
