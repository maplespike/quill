// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchScience } from '@maplespike/pipeline-core';

export const definition: ToolDefinition = {
  name: 'search_science',
  description: 'Search Canadian science, space, and research data — CSA missions, Mitacs grants, Ocean Networks Canada observations, Polar Data Catalogue records',
  descriptions: {
    'fr-CA': 'Rechercher des données sur la science, l\'espace et la recherche au Canada — missions de l\'ASC, subventions Mitacs, observations d\'Ocean Networks Canada, registres du Catalogue de données polaires',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 2000, description: 'Search term for science/research records' },
      limit: { type: 'number', description: 'Max results (default 20)' },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Number(args.limit ?? 20);

  const result = await searchScience(query);

  return {
    content: {
      tool: 'search_science',
      query,
      limit,
      grants: result.grants.slice(0, limit),
      missions: result.missions.slice(0, limit),
      observations: result.observations.slice(0, limit),
      polar: result.polar.slice(0, limit),
    },
  };
};
