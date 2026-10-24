// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import {
  ingestWDIIndicator,
  getCountryProfile,
  compareCountries,
  analyzeIndicatorTrend,
  fetchTopicData,
  getIndicatorMetadata,
  CORE_INDICATORS,
  TOPIC_INDICATORS,
} from '@maplespike/pipeline-core/worldbank-wdi';

export const getWDIIndicatorDefinition: ToolDefinition = {
  name: 'get_wdi_indicator',
  description: 'Fetch World Bank Development Indicator data for specific countries',
  inputSchema: {
    type: 'object',
    properties: {
      indicatorCode: {
        type: 'string',
        description: 'World Bank indicator code (e.g., NY.GDP.MKTP.CD for GDP)',
      },
      countries: {
        type: 'array',
        items: { type: 'string' },
        description: 'Country codes (ISO 3166-1 alpha-3, default: major economies)',
      },
      dateRange: {
        type: 'string',
        description: 'Year range (e.g., "2000:2023")',
      },
    },
    required: ['indicatorCode'],
  },
};

export const compareWDICountriesDefinition: ToolDefinition = {
  name: 'compare_wdi_countries',
  description: 'Compare a World Bank indicator across multiple countries',
  inputSchema: {
    type: 'object',
    properties: {
      indicatorCode: {
        type: 'string',
        description: 'World Bank indicator code',
      },
      countries: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        description: 'Country codes to compare',
      },
      dateRange: {
        type: 'string',
        description: 'Year range',
      },
    },
    required: ['indicatorCode', 'countries'],
  },
};

export const getCountryWDIProfileDefinition: ToolDefinition = {
  name: 'get_country_wdi_profile',
  description: 'Get a country profile with the key development indicators the World Bank WDI publishes for that country',
  inputSchema: {
    type: 'object',
    properties: {
      country: {
        type: 'string',
        description: 'Country code (ISO 3166-1 alpha-3)',
      },
      dateRange: {
        type: 'string',
        description: 'Year range',
      },
    },
    required: ['country'],
  },
};

export const analyzeIndicatorTrendDefinition: ToolDefinition = {
  name: 'analyze_indicator_trend',
  description: 'Analyze trend for a World Bank indicator over time',
  inputSchema: {
    type: 'object',
    properties: {
      indicatorCode: {
        type: 'string',
        description: 'World Bank indicator code',
      },
      country: {
        type: 'string',
        description: 'Country code',
      },
      dateRange: {
        type: 'string',
        description: 'Year range',
      },
    },
    required: ['indicatorCode', 'country'],
  },
};

export const fetchTopicIndicatorsDefinition: ToolDefinition = {
  name: 'fetch_topic_indicators',
  description: 'Fetch the World Bank WDI indicators published under a topic (economy, health, social, etc.)',
  inputSchema: {
    type: 'object',
    properties: {
      topicCode: {
        type: 'string',
        enum: Object.keys(TOPIC_INDICATORS),
        description: 'Topic code (economy, social, health, infrastructure, environment, governance)',
      },
      countries: {
        type: 'array',
        items: { type: 'string' },
        description: 'Country codes (default: all countries)',
      },
      dateRange: {
        type: 'string',
        description: 'Year range',
      },
    },
    required: ['topicCode'],
  },
};

export const getIndicatorMetadataDefinition: ToolDefinition = {
  name: 'get_indicator_metadata',
  description: 'Get metadata for a World Bank indicator',
  inputSchema: {
    type: 'object',
    properties: {
      indicatorCode: {
        type: 'string',
        description: 'World Bank indicator code',
      },
    },
    required: ['indicatorCode'],
  },
};

export const getWDIIndicatorHandler: ToolHandler = async (args) => {
  const indicatorCode = args.indicatorCode as string;
  const countries = args.countries as string[] | undefined;
  const dateRange = args.dateRange as string | undefined;

  try {
    const result = await ingestWDIIndicator(indicatorCode, countries, dateRange);

    return {
      content: {
        tool: 'get_wdi_indicator',
        indicatorCode,
        countries,
        dateRange,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_wdi_indicator',
        indicatorCode,
        countries,
        dateRange,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const compareWDICountriesHandler: ToolHandler = async (args) => {
  const indicatorCode = args.indicatorCode as string;
  const countries = args.countries as string[];
  const dateRange = args.dateRange as string | undefined;

  try {
    const result = await compareCountries(indicatorCode, countries, dateRange);

    return {
      content: {
        tool: 'compare_wdi_countries',
        indicatorCode,
        countries,
        dateRange,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'compare_wdi_countries',
        indicatorCode,
        countries,
        dateRange,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const getCountryWDIProfileHandler: ToolHandler = async (args) => {
  const country = args.country as string;
  const dateRange = args.dateRange as string | undefined;

  try {
    const result = await getCountryProfile(country, dateRange);

    return {
      content: {
        tool: 'get_country_wdi_profile',
        country,
        dateRange,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_country_wdi_profile',
        country,
        dateRange,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const analyzeIndicatorTrendHandler: ToolHandler = async (args) => {
  const indicatorCode = args.indicatorCode as string;
  const country = args.country as string;
  const dateRange = args.dateRange as string | undefined;

  try {
    const result = await analyzeIndicatorTrend(indicatorCode, country, dateRange);

    return {
      content: {
        tool: 'analyze_indicator_trend',
        indicatorCode,
        country,
        dateRange,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'analyze_indicator_trend',
        indicatorCode,
        country,
        dateRange,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const fetchTopicIndicatorsHandler: ToolHandler = async (args) => {
  const topicCode = args.topicCode as string;
  const countries = args.countries as string[] | undefined;
  const dateRange = args.dateRange as string | undefined;

  try {
    const result = await fetchTopicData(topicCode, countries, dateRange);

    return {
      content: {
        tool: 'fetch_topic_indicators',
        topicCode,
        countries,
        dateRange,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'fetch_topic_indicators',
        topicCode,
        countries,
        dateRange,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const getIndicatorMetadataHandler: ToolHandler = async (args) => {
  const indicatorCode = args.indicatorCode as string;

  try {
    const result = await getIndicatorMetadata(indicatorCode);

    return {
      content: {
        tool: 'get_indicator_metadata',
        indicatorCode,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_indicator_metadata',
        indicatorCode,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};