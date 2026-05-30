// SPDX-License-Identifier: MIT

import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestUnDataset, ingestMultipleDatasets, UN_DATABASES } from '@maplespike/pipeline-core';

export const getUnDatasetDefinition: ToolDefinition = {
  name: 'get_un_dataset',
  description: 'Fetch UN data for a specific database and dataset',
  inputSchema: {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        enum: Object.keys(UN_DATABASES),
        description: 'UN database (e.g., UNCTAD, WHO, UNESCO, ILO, FAO, UNDP, UNIDO)',
      },
      dataset: {
        type: 'string',
        description: 'Dataset code within the database',
      },
      country: {
        type: 'string',
        description: 'Country/territory code (e.g., CAN, USA, CHN)',
      },
      year: {
        type: 'number',
        description: 'Specific year (optional)',
      },
      format: {
        type: 'string',
        enum: ['json', 'xml', 'csv'],
        description: 'Response format (default: json)',
      },
      maxRecords: {
        type: 'number',
        description: 'Maximum records to return (default: 1000)',
      },
    },
    required: ['database', 'dataset'],
  },
};

export const searchUnIndicatorsDefinition: ToolDefinition = {
  name: 'search_un_indicators',
  description: 'Search UN indicators across all available databases',
  inputSchema: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: 'Search keyword for indicators',
      },
      country: {
        type: 'string',
        description: 'Filter by country code (e.g., CAN, USA)',
      },
      database: {
        type: 'string',
        description: 'Filter by UN database code (e.g., UNCTAD, WHO, UNESCO)',
      },
      year: {
        type: 'number',
        description: 'Filter by year',
      },
      maxRecords: {
        type: 'number',
        description: 'Maximum results across all datasets (default: 500)',
      },
    },
    required: ['keyword'],
  },
};

export const compareUnCountriesDefinition: ToolDefinition = {
  name: 'compare_un_countries',
  description: 'Compare UN indicators across multiple countries',
  inputSchema: {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        enum: Object.keys(UN_DATABASES),
        description: 'UN database to query',
      },
      dataset: {
        type: 'string',
        description: 'Dataset code within the database',
      },
      countries: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        description: 'Country codes to compare',
      },
      year: {
        type: 'number',
        description: 'Year to compare',
      },
    },
    required: ['database', 'dataset', 'countries'],
  },
};

export const getUnDatasetHandler: ToolHandler = async (args) => {
  const database = args.database as string;
  const dataset = args.dataset as string;
  const country = args.country as string | undefined;
  const year = args.year as number | undefined;
  const format = (args.format as 'json' | 'xml' | 'csv') || 'json';
  const maxRecords = args.maxRecords as number | undefined;

  try {
    const result = await ingestUnDataset(database, dataset, {
      country,
      year,
      format,
      maxRecords,
    });

    return {
      content: {
        tool: 'get_un_dataset',
        database,
        dataset,
        country,
        year,
        format,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_un_dataset',
        database,
        dataset,
        country,
        year,
        format,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const searchUnIndicatorsHandler: ToolHandler = async (args) => {
  const keyword = args.keyword as string;
  const country = args.country as string | undefined;
  const database = args.database as string | undefined;
  const year = args.year as number | undefined;
  const maxRecords = args.maxRecords as number | undefined;

  try {
    const datasets = Object.entries(UN_DATABASES);
    const results: any[] = [];

    for (const [dbKey, dbInfo] of datasets) {
      if (database && dbInfo.code !== database) continue;

      const result = await ingestUnDataset(dbInfo.code, dbInfo.code, {
        country,
        year,
        maxRecords: maxRecords ? Math.floor(maxRecords / datasets.length) : undefined,
      });

      const filtered = result.records.filter((r: any) => {
        const keywordMatch =
          !keyword ||
          r.datasetDescription.toLowerCase().includes(keyword.toLowerCase()) ||
          Object.values(r.dimensions).some(
            (v) => String(v).toLowerCase().includes(keyword.toLowerCase()),
          );

        const countryMatch = !country || r.country === country;

        return keywordMatch && countryMatch;
      });

      results.push(...filtered);

      if (maxRecords && results.length >= maxRecords) break;
    }

    return {
      content: {
        tool: 'search_un_indicators',
        keyword,
        country,
        database,
        year,
        data: results,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'search_un_indicators',
        keyword,
        country,
        database,
        year,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const compareUnCountriesHandler: ToolHandler = async (args) => {
  const database = args.database as string;
  const dataset = args.dataset as string;
  const countries = args.countries as string[];
  const year = args.year as number;

  try {
    const results = await ingestMultipleDatasets({
      database,
      datasets: countries.map((c) => ({ database, dataset })),
      maxRecords: 1000,
    } as any);

    const byCountry = new Map<string, any[]>();
    for (const result of results) {
      result.records.forEach((r: any) => {
        if (r.country && countries.includes(r.country)) {
          if (!byCountry.has(r.country)) byCountry.set(r.country, []);
          byCountry.get(r.country)!.push(r);
        }
      });
    }

    const comparison = Array.from(byCountry.entries()).map(([country, records]) => ({
      country,
      year: records[0]?.year || year,
      totalValue: records.reduce((sum: number, r: any) => sum + r.value, 0),
      averageValue: records.length > 0 ? records.reduce((sum: number, r: any) => sum + r.value, 0) / records.length : 0,
      recordCount: records.length,
      indicators: records.map((r: any) => r.datasetDescription).slice(0, 3),
    }));

    return {
      content: {
        tool: 'compare_un_countries',
        database,
        dataset,
        countries,
        year,
        data: comparison,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'compare_un_countries',
        database,
        dataset,
        countries,
        year,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};