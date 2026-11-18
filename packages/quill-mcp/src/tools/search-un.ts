// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import {
  ingestUnDataset,
  UN_DATABASES,
  UN_DATABASE_NAMES,
  UN_DATABASES_BY_CATEGORY,
  unDataUrl,
  unDataExplorerUrl,
} from '@maplespike/pipeline-core/ingestion/un';

export const definition: ToolDefinition = {
  name: 'search_un',
  description:
    'Search UN Data Sources via the UNdata SDMX REST API — population, trade, national accounts, ' +
    'development indicators, environment, energy, education, health statistics. ' +
    'Supports querying by database category or specific dataflow ID.',
  inputSchema: {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        description:
          'Database key to query (POP, POP_VITAL, TRADE, TRADE_SERVICES, NATIONAL_ACCOUNTS, ' +
          'DEVELOPMENT, ENVIRONMENT, ENERGY, EDUCATION, HEALTH) or a full dataflow ID (e.g. UNSD/DF_POP)',
      },
      category: {
        type: 'string',
        description:
          'Category to batch-query: population, trade, development, environment, health, education, energy, finance',
      },
      key: {
        type: 'string',
        description: 'SDMX dimension key filter (e.g. country code like "124" for Canada)',
      },
      startTime: {
        type: 'string',
        description: 'Start time period (e.g. "2020")',
      },
      endTime: {
        type: 'string',
        description: 'End time period (e.g. "2024")',
      },
      listDatabases: {
        type: 'boolean',
        description: 'List available UN databases and their categories instead of querying data',
      },
    },
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const listDatabases = args.listDatabases === true;

  if (listDatabases) {
    const databases = Object.entries(UN_DATABASES).map(([key, dataflowId]) => ({
      key,
      dataflowId,
      name: UN_DATABASE_NAMES[dataflowId] ?? dataflowId,
      explorerUrl: unDataExplorerUrl(dataflowId),
    }));
    const categories = Object.entries(UN_DATABASES_BY_CATEGORY).map(([cat, codes]) => ({
      category: cat,
      databases: codes.map((code) => UN_DATABASE_NAMES[code] ?? code),
    }));
    return {
      content: {
        tool: 'search_un',
        databases,
        categories,
      },
    };
  }

  const category = args.category as string | undefined;
  const database = args.database as string | undefined;

  if (!category && !database) {
    return {
      content: {
        tool: 'search_un',
        error: 'Provide a "database" key (e.g. POP, TRADE), a full dataflow ID, or a "category". Set listDatabases=true to see options.',
      },
      isError: true,
    };
  }

  try {
    if (category) {
      const codes = UN_DATABASES_BY_CATEGORY[category as keyof typeof UN_DATABASES_BY_CATEGORY];
      if (!codes || codes.length === 0) {
        return {
          content: {
            tool: 'search_un',
            error: `Unknown or empty category: "${category}". Set listDatabases=true to see available categories.`,
          },
          isError: true,
        };
      }

      const results = await Promise.all(
        codes.map((dataflowId) =>
          ingestUnDataset(dataflowId, {
            key: args.key as string | undefined,
            startTime: args.startTime as string | undefined,
            endTime: args.endTime as string | undefined,
          }),
        ),
      );

      return {
        content: {
          tool: 'search_un',
          category,
          results,
        },
      };
    }

    const dataflowId = (UN_DATABASES as Record<string, string>)[database!] ?? database!;
    const result = await ingestUnDataset(dataflowId, {
      key: args.key as string | undefined,
      startTime: args.startTime as string | undefined,
      endTime: args.endTime as string | undefined,
    });

    return {
      content: {
        tool: 'search_un',
        database: database!,
        dataflowId,
        result,
        dataUrl: unDataUrl(dataflowId, {
          key: args.key as string | undefined,
          startTime: args.startTime as string | undefined,
          endTime: args.endTime as string | undefined,
        }),
        explorerUrl: unDataExplorerUrl(dataflowId),
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_un',
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
};
