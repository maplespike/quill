// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestGTFSAgency, GTFS_AGENCIES, GTFS_FEED_URLS } from '@maplespike/pipeline-core/gtfs-transit';

export const listGTFSAgenciesDefinition: ToolDefinition = {
  name: 'list_gtfs_agencies',
  description: 'List all 31 Canadian transit agencies with GTFS data. Covers all provinces with routes, stops, and schedule data.',
  inputSchema: {
    type: 'object',
    properties: {
      province: {
        type: 'string',
        description: 'Filter by province code (BC, AB, SK, MB, ON, QC, NS, NB, NL)',
      },
      type: {
        type: 'string',
        enum: ['urban', 'regional', 'ferry', 'rail'],
        description: 'Filter by transit type',
      },
    },
  },
};

export const getGTFSByCityDefinition: ToolDefinition = {
  name: 'get_gtf_by_city',
  description: 'Fetch GTFS transit data for a specific city/agency (STM, Exo, BC Transit, TransLink, etc.)',
  inputSchema: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'Transit agency ID or name (e.g., translink, calgary, ttc, stm, go-transit)',
      },
    },
    required: ['city'],
  },
};

export const searchGTFSRoutesDefinition: ToolDefinition = {
  name: 'search_gtfs_routes',
  description: 'Search GTFS routes across Canadian transit agencies. Returns route names, types, and colors.',
  inputSchema: {
    type: 'object',
    properties: {
      agencyId: {
        type: 'string',
        description: 'Agency ID (e.g., ttc, translink, stm)',
      },
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search route name or number',
      },
    },
    required: ['agencyId'],
  },
};

export const searchGTFSStopsDefinition: ToolDefinition = {
  name: 'search_gtfs_stops',
  description: 'Search GTFS stops across Canadian transit agencies. Returns stop locations and names.',
  inputSchema: {
    type: 'object',
    properties: {
      agencyId: {
        type: 'string',
        description: 'Agency ID (e.g., ttc, translink, stm)',
      },
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search stop name',
      },
    },
    required: ['agencyId'],
  },
};

export const listGTFSAgenciesHandler: ToolHandler = async (args) => {
  const province = args.province as string | undefined;
  const type = args.type as string | undefined;

  let agencies = GTFS_AGENCIES;
  if (province) agencies = agencies.filter(a => a.province === province);
  if (type) agencies = agencies.filter(a => a.type === type);

  return {
    content: {
      tool: 'list_gtfs_agencies',
      total: agencies.length,
      agencies: agencies.map(a => ({
        id: a.id,
        name: a.name,
        province: a.province,
        type: a.type,
        hasFeedUrl: !!GTFS_FEED_URLS[a.id],
      })),
    },
  };
};

export const getGTFSByCityHandler: ToolHandler = async (args) => {
  const city = args.city as string;
  try {
    const result = await ingestGTFSAgency(city);
    return { content: { tool: 'get_gtf_by_city', city, data: result } };
  } catch (error) {
    return { content: { tool: 'get_gtf_by_city', city, error: (error as Error).message }, isError: true };
  }
};

export const searchGTFSRoutesHandler: ToolHandler = async (args) => {
  const agencyId = args.agencyId as string;
  const query = (args.query as string || '').toLowerCase();
  try {
    const result = await ingestGTFSAgency(agencyId);
    const routes = query
      ? result.routes.filter(r => r.routeLongName.toLowerCase().includes(query) || r.routeShortName.toLowerCase().includes(query))
      : result.routes;
    return { content: { tool: 'search_gtfs_routes', agencyId, query: query || undefined, total: routes.length, routes: routes.slice(0, 20) } };
  } catch (error) {
    return { content: { tool: 'search_gtfs_routes', agencyId, error: (error as Error).message }, isError: true };
  }
};

export const searchGTFSStopsHandler: ToolHandler = async (args) => {
  const agencyId = args.agencyId as string;
  const query = (args.query as string || '').toLowerCase();
  try {
    const result = await ingestGTFSAgency(agencyId);
    const stops = query
      ? result.stops.filter(s => s.stopName.toLowerCase().includes(query))
      : result.stops;
    return { content: { tool: 'search_gtfs_stops', agencyId, query: query || undefined, total: stops.length, stops: stops.slice(0, 20) } };
  } catch (error) {
    return { content: { tool: 'search_gtfs_stops', agencyId, error: (error as Error).message }, isError: true };
  }
};
