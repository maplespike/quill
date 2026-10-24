// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestComtrade, getTradeByCommodity } from '@maplespike/pipeline-core/un-comtrade';

export const getComtradeByPartnerDefinition: ToolDefinition = {
  name: 'get_comtrade_by_partner',
  description: 'Fetch UN Comtrade trade data for a specific partner country',
  inputSchema: {
    type: 'object',
    properties: {
      partner: {
        type: 'string',
        description: 'Country code (e.g., US, CN)',
      },
      year: { type: 'number' },
    },
    required: ['partner'],
  },
};

export const getComtradeByCommodityDefinition: ToolDefinition = {
  name: 'get_comtrade_by_commodity',
  description: 'Fetch UN Comtrade trade data for a specific commodity',
  inputSchema: {
    type: 'object',
    properties: {
      commodityCode: {
        type: 'string',
        description: 'HS commodity code',
      },
      year: { type: 'number' },
    },
    required: ['commodityCode'],
  },
};

export const getComtradeTrendsDefinition: ToolDefinition = {
  name: 'get_comtrade_trends',
  description: 'Get UN Comtrade trade trends over time',
  inputSchema: {
    type: 'object',
    properties: {
      partner: {
        type: 'string',
        description: 'Country code (e.g., US, CN)',
      },
      years: {
        type: 'array',
        items: { type: 'number' },
      },
    },
    required: ['partner'],
  },
};

export const getComtradeByPartnerHandler: ToolHandler = async (args) => {
  const partner = args.partner as string;
  const year = args.year as number | undefined;

  try {
    const result = await ingestComtrade(partner, year);
    return {
      content: {
        tool: 'get_comtrade_by_partner',
        partner,
        year,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_comtrade_by_partner',
        partner,
        year,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const getComtradeByCommodityHandler: ToolHandler = async (args) => {
  const commodityCode = args.commodityCode as string;
  const year = args.year as number | undefined;

  try {
    const result = await getTradeByCommodity(commodityCode);
    return {
      content: {
        tool: 'get_comtrade_by_commodity',
        commodityCode,
        year,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_comtrade_by_commodity',
        commodityCode,
        year,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const getComtradeTrendsHandler: ToolHandler = async (args) => {
  const partner = args.partner as string;
  const years = args.years as number[] | undefined;

  try {
    const result = await ingestComtrade(partner);
    return {
      content: {
        tool: 'get_comtrade_trends',
        partner,
        years,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_comtrade_trends',
        partner,
        years,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};