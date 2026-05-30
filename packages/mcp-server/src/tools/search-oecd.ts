// SPDX-License-Identifier: MIT

import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestOecdDataset, ingestByTopic, ingestAllOecd, searchOecdRecords } from '@maplespike/pipeline-core/oecd';

export const searchOecdDefinition: ToolDefinition = {
  name: 'search_oecd',
  description: 'Search OECD Data Explorer for national accounts, health statistics, and comparative indicators',
  inputSchema: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: 'Search keyword (indicator name or code)',
      },
      country: {
        type: 'string',
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
    const result = await ingestOecdDataset(datasetId);

    return {
      content: {
        tool: 'get_oecd_dataset',
        datasetId,
        datasetsAttempted: result.datasetsAttempted,
        datasetsSucceeded: result.datasetsSucceeded,
        recordsCount: result.records.length,
        durationMs: result.durationMs,
        errors: result.errors,
        data: result.records,
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
    const result = await ingestByTopic(topic);

    return {
      content: {
        tool: 'get_oecd_by_topic',
        topic,
        datasetsAttempted: result.datasetsAttempted,
        datasetsSucceeded: result.datasetsSucceeded,
        recordsCount: result.records.length,
        durationMs: result.durationMs,
        errors: result.errors,
        data: result.records,
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