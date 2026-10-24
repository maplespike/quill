// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { searchMunicipal } from '@maplespike/pipeline-core/municipal';

export const definition: ToolDefinition = {
  name: 'search_municipal',
  description: 'Search municipal open data from Canadian cities (Victoria, Edmonton, Toronto, Vancouver, Montreal, Ottawa, Calgary, etc.)',
  inputSchema: {
    type: 'object',
    properties: {
      municipality: {
        type: 'string',
        description: 'Municipality ID (e.g., victoria, toronto, ottawa, vancouver, montreal)',
      },
      province: {
        type: 'string',
        description: 'Filter by province code (e.g., ON, BC, AB, QC)',
      },
      dataset: {
        type: 'string',
        description: 'Dataset type (budget, permits, zoning, transit, 311-calls)',
      },
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search query within dataset',
      },
    },
  },
};

export const handler: ToolHandler = async (args) => {
  const municipality = args.municipality as string | undefined;
  const province = args.province as string | undefined;
  const dataset = args.dataset as string | undefined;
  const query = args.query as string | undefined;

  try {
    const results = searchMunicipal({ municipality, province, dataset, query });

    return {
      content: {
        tool: 'search_municipal',
        params: { municipality, province, dataset, query },
        count: results.length,
        municipalities: [...new Set(results.map((r: { municipality: string }) => r.municipality))],
        records: results,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'search_municipal',
        params: { municipality, province, dataset, query },
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};
