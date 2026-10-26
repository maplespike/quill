// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestAllPublicAccounts } from '@maplespike/pipeline-core/public-accounts';

export const getPublicAccountsDefinition: ToolDefinition = {
  name: 'get_public_accounts',
  description: 'Fetch federal public accounts data for a specific year',
  inputSchema: {
    type: 'object',
    properties: {
      year: { type: 'number' },
    },
    required: [],
  },
};

export const getDepartmentSpendingDefinition: ToolDefinition = {
  name: 'get_department_spending',
  description: 'Get spending data for a specific federal department',
  inputSchema: {
    type: 'object',
    properties: {
      department: {
        type: 'string',
        maxLength: 500,
        description: 'Department name',
      },
      year: { type: 'number' },
    },
    required: ['department'],
  },
};

export const compareSpendingTrendsDefinition: ToolDefinition = {
  name: 'compare_spending_trends',
  description: 'Compare spending trends across multiple federal departments',
  inputSchema: {
    type: 'object',
    properties: {
      departments: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
      },
      years: {
        type: 'array',
        items: { type: 'number' },
      },
    },
    required: ['departments'],
  },
};

export const getPublicAccountsHandler: ToolHandler = async (args) => {
  const year = args.year as number | undefined;

  try {
    const result = await ingestAllPublicAccounts();
    return {
      content: {
        tool: 'get_public_accounts',
        year,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_public_accounts',
        year,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const getDepartmentSpendingHandler: ToolHandler = async (args) => {
  const department = args.department as string;
  const year = args.year as number | undefined;

  try {
    const result = await ingestAllPublicAccounts();
    return {
      content: {
        tool: 'get_department_spending',
        department,
        year,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_department_spending',
        department,
        year,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const compareSpendingTrendsHandler: ToolHandler = async (args) => {
  const departments = args.departments as string[];
  const years = args.years as number[] | undefined;

  try {
    const result = await ingestAllPublicAccounts();
    return {
      content: {
        tool: 'compare_spending_trends',
        departments,
        years,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'compare_spending_trends',
        departments,
        years,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};