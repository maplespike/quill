import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_ati_requests',
  description:
    'Search completed Access to Information (ATI) request summaries published by federal departments. ' +
    'Covers ATI request titles, department, request number, and disposition across all federal institutions ' +
    'subject to the Access to Information Act.',
  descriptions: {
    'fr-CA': 'Rechercher les sommaires des demandes d\'accès à l\'information (AIPRP) complétées par les départements fédéraux.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — topic, department, or request number (e.g., "climate change ECCC", "procurement PSPC", "A-2024-00123")',
      },
      department: {
        type: 'string',
        description: 'Filter by federal department or agency',
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
        tool: 'search_ati_requests',
        query: '',
        error: 'No search query provided. Specify a topic, department, or ATI request number.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);

  const result = await searchGovData(`access to information ATI request ${query}`, 'federal', limit);

  return {
    content: {
      tool: 'search_ati_requests',
      query,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
