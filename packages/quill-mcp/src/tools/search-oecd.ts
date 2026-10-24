// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestOecdDataset, ingestByTopic, ingestAllOecd, searchOecdRecords } from '@maplespike/pipeline-core';

export const searchOecdDefinition: ToolDefinition = {
  name: 'search_oecd',
  description: 'Search OECD Data Explorer for national accounts, health statistics, and comparative indicators',
  inputSchema: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        maxLength: 2000,
        description: 'Search keyword (indicator name or code)',
      },
      country: {
        type: 'string',
        maxLength: 500,
        description: 'Country code (e.g., CAN, USA, GBR)',
      },
      indicatorCode: {
        type: 'string',
        description: 'Specific indicator code to filter',
      },
      yearStart: {
        type: 'number',
        description: 'Start year for time series filter',
      },
      yearEnd: {
        type: 'number',
        description: 'End year for time series filter',
      },
    },
    required: ['keyword'],
  },
};

export const getOecdDatasetDefinition: ToolDefinition = {
  name: 'get_oecd_dataset',
  description: 'Fetch all data from a specific OECD dataset',
  inputSchema: {
    type: 'object',
    properties: {
      datasetId: {
        type: 'string',
        description: 'Dataset ID (e.g., NAAG, HEALTH)',
        enum: ['NAAG', 'HEALTH'],
      },
    },
    required: ['datasetId'],
  },
};

export const getOecdByTopicDefinition: ToolDefinition = {
  name: 'get_oecd_by_topic',
  description: 'Fetch all OECD data for a topic area',
  inputSchema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Topic code (e.g., NAAG, HEALTH)',
        enum: ['NAAG', 'HEALTH'],
      },
    },
    required: ['topic'],
  },
};

export const searchOecdHandler: ToolHandler = async (args) => {
  const keyword = args.keyword as string;
  const country = args.country as string | undefined;
  const indicatorCode = args.indicatorCode as string | undefined;
  const yearStart = args.yearStart as number | undefined;
  const yearEnd = args.yearEnd as number | undefined;

  try {
    const records = await searchOecdRecords(keyword, {
      country,
      indicatorCode,
      yearStart,
      yearEnd,
    });

    return {
      content: {
        tool: 'search_oecd',
        keyword,
        country,
        indicatorCode,
        yearStart,
        yearEnd,
        count: records.length,
        data: records,
        attribution: records.length > 0 ? 'OECD Data Explorer — https://data-explorer.oecd.org (OECD Open Data)' : undefined,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'search_oecd',
        keyword,
        country,
        indicatorCode,
        yearStart,
        yearEnd,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const getOecdDatasetHandler: ToolHandler = async (args) => {
  const datasetId = args.datasetId as string;

  try {
    const result = await ingestOecdDataset(datasetId) as any;

    return {
      content: {
        tool: 'get_oecd_dataset',
        datasetId,
        datasetsAttempted: result.data.datasetsAttempted,
        datasetsSucceeded: result.data.datasetsSucceeded,
        recordsCount: result.data.records.length,
        durationMs: result.data.durationMs,
        errors: result.data.errors,
        data: result.data.records,
        attribution: result.data.records.length > 0 ? result.attribution.attributionText : undefined,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_oecd_dataset',
        datasetId,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const getOecdByTopicHandler: ToolHandler = async (args) => {
  const topic = args.topic as string;

  try {
    const result = await ingestByTopic(topic) as any;

    return {
      content: {
        tool: 'get_oecd_by_topic',
        topic,
        datasetsAttempted: result.data.datasetsAttempted,
        datasetsSucceeded: result.data.datasetsSucceeded,
        recordsCount: result.data.records.length,
        durationMs: result.data.durationMs,
        errors: result.data.errors,
        data: result.data.records,
        attribution: result.data.records.length > 0 ? result.attribution?.attributionText : undefined,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_oecd_by_topic',
        topic,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};