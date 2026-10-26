// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestFireData } from '@maplespike/pipeline-core/fire-emergency';

export const getFireByCityDefinition: ToolDefinition = {
  name: 'get_fire_by_city',
  description: 'Fetch fire department data for a specific city (Edmonton, Montreal, Quebec City, Sherbrooke)',
  inputSchema: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'City name (e.g., Edmonton, Montreal)',
      },
    },
    required: ['city'],
  },
};

export const compareFireResponseDefinition: ToolDefinition = {
  name: 'compare_fire_response',
  description: 'Compare fire response times across multiple cities',
  inputSchema: {
    type: 'object',
    properties: {
      cities: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
      },
      year: { type: 'number' },
    },
    required: ['cities'],
  },
};

export const getFireTrendsDefinition: ToolDefinition = {
  name: 'get_fire_trends',
  description: 'Get fire department trends over time for a specific city',
  inputSchema: {
    type: 'object',
    properties: {
      city: { type: 'string' },
      years: {
        type: 'array',
        items: { type: 'number' },
      },
    },
    required: ['city'],
  },
};

export const getFireByCityHandler: ToolHandler = async (args) => {
  const city = args.city as string;

  try {
    const result = await ingestFireData(city);
    return {
      content: {
        tool: 'get_fire_by_city',
        city,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_fire_by_city',
        city,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const compareFireResponseHandler: ToolHandler = async (args) => {
  const cities = args.cities as string[];
  const year = args.year as number | undefined;

  try {
    const results = await Promise.all(cities.map((c) => ingestFireData(c)));
    return {
      content: {
        tool: 'compare_fire_response',
        cities,
        year,
        data: results,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'compare_fire_response',
        cities,
        year,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const getFireTrendsHandler: ToolHandler = async (args) => {
  const city = args.city as string;
  const years = args.years as number[] | undefined;

  try {
    const result = await ingestFireData(city);
    return {
      content: {
        tool: 'get_fire_trends',
        city,
        years,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_fire_trends',
        city,
        years,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};