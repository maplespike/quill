import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_impact_assessment',
  description:
    'Search Impact Assessment Agency of Canada (IAAC) data — federal environmental project assessments, ' +
    'decisions, conditions, and timelines. Covers designated projects requiring federal impact assessment ' +
    'under the Impact Assessment Act.',
  descriptions: {
    'fr-CA': 'Rechercher des données de l\'Agence d\'évaluation d\'impact du Canada — évaluations de projets environnementaux fédéraux, décisions, conditions et calendriers.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — project name, proponent, location, or assessment type (e.g., "pipeline trans mountain", "mining project BC", "environmental assessment Ontario")',
      },
      status: {
        type: 'string',
        enum: ['planning', 'assessment', 'decision', 'post_decision', 'all'],
        description: 'Assessment status filter (default: all)',
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
        tool: 'search_impact_assessment',
        query: '',
        error: 'No search query provided. Specify a project name, proponent, or location.',
      },
      isError: true,
    };
  }

  const status = (args.status as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const result = await searchGovData(`impact assessment environmental project ${status !== 'all' ? status + ' ' : ''}${query}`, 'federal', limit);

  return {
    content: {
      tool: 'search_impact_assessment',
      query,
      status,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
