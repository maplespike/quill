// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { searchLibraries, LIBRARY_PORTALS } from '@maplespike/pipeline-core/library';

export const definition: ToolDefinition = {
  name: 'search_libraries',
  description: 'Search Canadian public library systems by city, province, or name. Covers 15 major Canadian cities. Returns branch locations, hours, and contact info.',
  inputSchema: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'City name (toronto, ottawa, montreal, vancouver, calgary, edmonton, etc.)',
      },
      province: {
        type: 'string',
        description: 'Province code (ON, QC, BC, AB, MB, NS)',
      },
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search by library name or city name',
      },
    },
  },
};

export const handler: ToolHandler = async (args) => {
  const city = args.city as string | undefined;
  const province = args.province as string | undefined;
  const query = args.query as string | undefined;

  try {
    const results = searchLibraries({ city, province, query });
    return {
      content: {
        tool: 'search_libraries',
        params: { city, province, query },
        total: results.length,
        portals: Object.keys(LIBRARY_PORTALS).length,
        libraries: results.map((r: { library: string; city: string; province: string; url?: string }) => ({
          library: r.library,
          city: r.city,
          province: r.province,
          url: r.url,
        })),
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'search_libraries',
        params: { city, province, query },
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};
