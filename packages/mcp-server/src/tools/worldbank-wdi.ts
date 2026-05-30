// SPDX-License-Identifier: MIT

import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestWDIIndicator, getCountryProfile, compareCountries } from '@maplespike/pipeline-core/worldbank-wdi';

export const getWDIIndicatorDefinition: ToolDefinition = {
  name: 'get_wdi_indicator',
  description: 'Fetch World Bank WDI indicator data',
  inputSchema: {
    type: 'object',
    properties: {
      indicatorCode: {
        type: 'string',
        description: 'Indicator code (e.g., NY.GDP.MKTP.CD)',
      },
      country: {
        type: 'string',
        description: 'Country code (e.g., CA)',
      },
      year: { type: 'number' },
    },
    required: ['indicatorCode'],
  },
};

export const compareWDICountriesDefinition: ToolDefinition = {
  name: 'compare_wdi_countries',
  description: 'Compare WDI indicator values across multiple countries',
  inputSchema: {
    type: 'object',
    properties: {
      indicatorCode: {
        type: 'string',
        description: 'Indicator code',
      },
      countries: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
      },
      year: { type: 'number' },
    },
    required: ['indicatorCode', 'countries'],
  },
};

export const getCountryWDIProfileDefinition: ToolDefinition = {
  name: 'get_country_wdi_profile',
  description: 'Get World Bank WDI profile for a specific country',
  inputSchema: {
    type: 'object',
    properties: {
      country: {
        type: 'string',
        description: 'Country code (e.g., CA)',
      },
    },
    required: ['country'],
  },
};

export const getWDIIndicatorHandler: ToolHandler = async (args) => {
  const indicatorCode = args.indicatorCode as string;
  const country = args.country as string | undefined;
  const year = args.year as number | undefined;

  try {
    const result = await ingestWDIIndicator(indicatorCode, country ? [country] : undefined);
    return {
      content: {
        tool: 'get_wdi_indicator',
        indicatorCode,
        country,
        year,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_wdi_indicator',
        indicatorCode,
        country,
        year,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const compareWDICountriesHandler: ToolHandler = async (args) => {
  const indicatorCode = args.indicatorCode as string;
  const countries = args.countries as string[];
  const year = args.year as number | undefined;

  try {
    const result = await compareCountries(indicatorCode, countries);
    return {
      content: {
        tool: 'compare_wdi_countries',
        indicatorCode,
        countries,
        year,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'compare_wdi_countries',
        indicatorCode,
        countries,
        year,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const getCountryWDIProfileHandler: ToolHandler = async (args) => {
  const country = args.country as string;

  try {
    const result = await getCountryProfile(country);
    return {
      content: {
        tool: 'get_country_wdi_profile',
        country,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_country_wdi_profile',
        country,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};