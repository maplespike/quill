// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestDonationsByJurisdiction } from '@maplespike/pipeline-core/political-donations';

export const getDonationsByJurisdictionDefinition: ToolDefinition = {
  name: 'get_donations_by_jurisdiction',
  description: 'Fetch political donations for a specific province or territory',
  inputSchema: {
    type: 'object',
    properties: {
      jurisdiction: {
        type: 'string',
        maxLength: 500,
description: 'Province or territory (e.g., BC, Ontario)',
      },
      year: { type: 'number' },
    },
    required: ['jurisdiction'],
  },
};

export const compareDonationsPartiesDefinition: ToolDefinition = {
  name: 'compare_donations_parties',
  description: 'Compare donations across political parties within a jurisdiction',
  inputSchema: {
    type: 'object',
    properties: {
      jurisdiction: { type: 'string' },
      year: { type: 'number' },
    },
    required: ['jurisdiction'],
  },
};

export const getDonationsTrendsDefinition: ToolDefinition = {
  name: 'get_donations_trends',
  description: 'Get political donation trends over time for a jurisdiction',
  inputSchema: {
    type: 'object',
    properties: {
      jurisdiction: { type: 'string' },
      years: {
        type: 'array',
        items: { type: 'number' },
      },
    },
    required: ['jurisdiction'],
  },
};

export const getDonationsByJurisdictionHandler: ToolHandler = async (args) => {
  const jurisdiction = args.jurisdiction as string;
  const year = args.year as number | undefined;

  try {
    const result = await ingestDonationsByJurisdiction(jurisdiction);
    return {
      content: {
        tool: 'get_donations_by_jurisdiction',
        jurisdiction,
        year,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_donations_by_jurisdiction',
        jurisdiction,
        year,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const compareDonationsPartiesHandler: ToolHandler = async (args) => {
  const jurisdiction = args.jurisdiction as string;
  const year = args.year as number | undefined;

  try {
    const result = await ingestDonationsByJurisdiction(jurisdiction);
    return {
      content: {
        tool: 'compare_donations_parties',
        jurisdiction,
        year,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'compare_donations_parties',
        jurisdiction,
        year,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};

export const getDonationsTrendsHandler: ToolHandler = async (args) => {
  const jurisdiction = args.jurisdiction as string;
  const years = args.years as number[] | undefined;

  try {
    const result = await ingestDonationsByJurisdiction(jurisdiction);
    return {
      content: {
        tool: 'get_donations_trends',
        jurisdiction,
        years,
        data: result,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'get_donations_trends',
        jurisdiction,
        years,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};