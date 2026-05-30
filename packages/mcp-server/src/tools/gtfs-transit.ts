// SPDX-License-Identifier: MIT

import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestGTFSAgency } from '@maplespike/pipeline-core/gtfs-transit';

export const getGTFSByCityDefinition: ToolDefinition = {
  name: 'get_gtf_by_city',
  description: 'Fetch GTFS transit data for a specific city/agency (STM, Exo, BC Transit, etc.)',
  inputSchema: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'Transit agency name (e.g., STM, Exo, BC Transit)',
      },
    },
    required: ['city'],
  },
};

export const getGTFSSchedulesDefinition: ToolDefinition = {
  name: 'get_gtfs_schedules',
  description: 'Fetch GTFS schedules for a specific city and optional route',
  inputSchema: {
    type: 'object',
    properties: {
      city: { type: 'string' },
      routeId: { type: 'string' },
    },
    required: ['city'],
  },
};

export const getGTFSTrendsDefinition: ToolDefinition = {
  name: 'get_gtfs_trends',
  description: 'Get GTFS trends over time (week, month, quarter, year)',
  inputSchema: {
    type: 'object',
    properties: {
      city: { type: 'string' },
      period: {
        type: 'string',
        enum: ['week', 'month', 'quarter', 'year'],
      },
    },
    required: ['city', 'period'],
  },
};

export const getGTFSByCityHandler: ToolHandler = async (args) => {
  const city = args.city as string;

  try {
    const result = await ingestGTFSAgency(city);
    return {
      content: {
        tool: 'get_gtf_by_city',
        city,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_gtf_by_city',
        city,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const getGTFSSchedulesHandler: ToolHandler = async (args) => {
  const city = args.city as string;
  const routeId = args.routeId as string | undefined;

  try {
    const result = await ingestGTFSAgency(city);
    return {
      content: {
        tool: 'get_gtfs_schedules',
        city,
        routeId,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_gtfs_schedules',
        city,
        routeId,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const getGTFSTrendsHandler: ToolHandler = async (args) => {
  const city = args.city as string;
  const period = args.period as string;

  try {
    const result = await ingestGTFSAgency(city);
    return {
      content: {
        tool: 'get_gtfs_trends',
        city,
        period,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_gtfs_trends',
        city,
        period,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};