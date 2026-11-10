// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestDonationsByJurisdiction } from '@maplespike/pipeline-core/political-donations';
import { applySourcePolicy } from '@maplespike/pipeline-core';

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

/** Shared runner. Donation records minimize personal contact details. */
export async function runDonationsTool(
  tool: string,
  fields: Record<string, unknown>,
  ingest: (jurisdiction: string) => Promise<unknown> = ingestDonationsByJurisdiction,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  const jurisdiction = String(fields.jurisdiction ?? '');
  try {
    const result = await ingest(jurisdiction);
    const applied = applySourcePolicy('political-donations', result == null ? [] : [result]);
    return {
      content: {
        tool,
        ...fields,
        data: applied.records[0] ?? null,
        policy: applied.policy,
      },
    };
  } catch (error) {
    return {
      content: {
        tool,
        ...fields,
        error: (error as Error).message,
      },
      isError: true,
    };
  }
}

export const getDonationsByJurisdictionHandler: ToolHandler = async (args) => {
  return runDonationsTool('get_donations_by_jurisdiction', {
    jurisdiction: args.jurisdiction,
    year: args.year,
  });
};

export const compareDonationsPartiesHandler: ToolHandler = async (args) => {
  return runDonationsTool('compare_donations_parties', {
    jurisdiction: args.jurisdiction,
    year: args.year,
  });
};

export const getDonationsTrendsHandler: ToolHandler = async (args) => {
  return runDonationsTool('get_donations_trends', {
    jurisdiction: args.jurisdiction,
    years: args.years,
  });
};