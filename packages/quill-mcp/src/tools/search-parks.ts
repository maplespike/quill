import type { ToolDefinition, ToolHandler } from './types.js';
import { searchParks, PARK_PORTALS } from '@maplespike/pipeline-core/parks';

export const definition: ToolDefinition = {
  name: 'search_parks',
  description: 'Search Canadian parks and recreation facilities by city or province. Covers 11 cities: Toronto, Vancouver, Calgary, Edmonton, Montreal, Ottawa, Mississauga, Surrey, Burnaby, Hamilton, Halifax. Returns park names, types, amenities, and sizes.',
  inputSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name (toronto, vancouver, calgary, etc.)' },
      province: { type: 'string', description: 'Province code (ON, BC, AB, QC, MB, NS)' },
      query: { type: 'string', maxLength: 2000, description: 'Search park name or city' },
    },
  },
};

export const handler: ToolHandler = async (args) => {
  const { city, province, query } = args as { city?: string; province?: string; query?: string };
  try {
    const results = searchParks({ city, province, query });
    return {
      content: {
        tool: 'search_parks', params: { city, province, query },
        total: results.length, portals: Object.keys(PARK_PORTALS).length,
        parks: results.map((r: { parkName: string; city: string; province: string }) => ({ park: r.parkName, city: r.city, province: r.province })),
      },
    };
  } catch (error) {
    return { content: { tool: 'search_parks', params: { city, province, query }, error: (error as Error).message }, isError: true };
  }
};
