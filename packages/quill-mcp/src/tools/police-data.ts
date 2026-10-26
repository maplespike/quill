// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestPoliceCity, searchPolice, POLICE_AGENCIES } from '@maplespike/pipeline-core/police-data';

export const getPoliceByCityDefinition: ToolDefinition = {
  name: 'get_police_by_city',
  description: 'Fetch police statistics for a specific city (Edmonton, Montreal, Quebec City, Sherbrooke, Calgary, Vancouver)',
  inputSchema: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        maxLength: 500,
description: 'City name (e.g., Edmonton, Montreal)',
      },
    },
    required: ['city'],
  },
};

export const comparePoliceCrimeDefinition: ToolDefinition = {
  name: 'compare_police_crime',
  description: 'Compare crime statistics across multiple cities',
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

export const getPoliceTrendsDefinition: ToolDefinition = {
  name: 'get_police_trends',
  description: 'Get police data trends over time for a specific city',
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

export const searchPoliceAgenciesDefinition: ToolDefinition = {
  name: 'search_police_agencies',
  description: 'Search Canadian municipal police agencies by city, province, or name. Covers 16 cities: Toronto, Ottawa, Peel, Durham, York, Hamilton, London, Edmonton, Calgary, Vancouver, Surrey, Montreal, Quebec City, Winnipeg, Halifax, Sherbrooke.',
  inputSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name' },
      province: { type: 'string', description: 'Province code (ON, AB, BC, QC, MB, NS)' },
      query: { type: 'string', maxLength: 2000, description: 'Search agency name or city' },
    },
  },
};

export const getPoliceByCityHandler: ToolHandler = async (args) => {
  const city = args.city as string;

  try {
    const result = await ingestPoliceCity(city);
    return {
      content: {
        tool: 'get_police_by_city',
        city,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_police_by_city',
        city,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const comparePoliceCrimeHandler: ToolHandler = async (args) => {
  const cities = args.cities as string[];
  const year = args.year as number | undefined;

  try {
    const results = await Promise.all(cities.map((c) => ingestPoliceCity(c)));
    return {
      content: {
        tool: 'compare_police_crime',
        cities,
        year,
        data: results,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'compare_police_crime',
        cities,
        year,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const getPoliceTrendsHandler: ToolHandler = async (args) => {
  const city = args.city as string;
  const years = args.years as number[] | undefined;

  try {
    const result = await ingestPoliceCity(city);
    return {
      content: {
        tool: 'get_police_trends',
        city,
        years,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_police_trends',
        city,
        years,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const searchPoliceAgenciesHandler: ToolHandler = async (args) => {
  const city = args.city as string | undefined;
  const province = args.province as string | undefined;
  const query = args.query as string | undefined;

  try {
    const results = searchPolice({ city, province, query });
    return {
      content: {
        tool: 'search_police_agencies',
        total: results.length,
        agencies: results.map(r => ({ agency: r.agency, city: r.city, province: r.province })),
      },
    };
  } catch (error) {
    return { content: { tool: 'search_police_agencies', error: (error as Error).message }, isError: true };
  }
};