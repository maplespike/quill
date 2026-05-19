import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_species_at_risk',
  description:
    'Search Species at Risk Act (SARA) registry — listing decisions, recovery strategies, ' +
    'management plans, and SARA status assessments. Covers federally listed endangered, threatened, ' +
    'and special concern species across Canada.',
  descriptions: {
    'fr-CA': 'Rechercher le registre de la Loi sur les espèces en péril (LEP) — décisions d\'inscription, stratégies de reprise, plans de gestion et évaluations de statut.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — species name, status, or region (e.g., "caribou boreal", "right whale Atlantic", "endangered species Ontario")',
      },
      status: {
        type: 'string',
        enum: ['extirpated', 'endangered', 'threatened', 'special_concern', 'all'],
        description: 'SARA status filter (default: all)',
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
        tool: 'search_species_at_risk',
        query: '',
        error: 'No search query provided. Specify a species name, status, or region.',
      },
      isError: true,
    };
  }

  const status = (args.status as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const result = await searchGovData(`species at risk SARA ${status !== 'all' ? status + ' ' : ''}${query}`, 'federal', limit);

  return {
    content: {
      tool: 'search_species_at_risk',
      query,
      status,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
