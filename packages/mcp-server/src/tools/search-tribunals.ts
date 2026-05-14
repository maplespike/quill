import type { ToolDefinition, ToolHandler } from './types.js';
import { searchTribunals } from '@maplespike/pipeline-core';

export const definition: ToolDefinition = {
  name: 'search_tribunals',
  description: 'Search Canadian federal tribunal decisions — SST (social security), CITT (trade), CHRT (human rights), Copyright Board, RCMP review, and more',
  descriptions: {
    'fr-CA': 'Rechercher des décisions de tribunaux fédéraux canadiens — TSS (sécurité sociale), TCCE (commerce), TCDP (droits humains), Commission du droit d\'auteur, examen de la GRC, et plus',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search term for tribunal decisions' },
      limit: { type: 'number', description: 'Max results (default 20)' },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Number(args.limit ?? 20);

  const result = await searchTribunals(query);

  return {
    content: {
      tool: 'search_tribunals',
      query,
      limit,
      decisions: result.decisions.slice(0, limit),
    },
  };
};
