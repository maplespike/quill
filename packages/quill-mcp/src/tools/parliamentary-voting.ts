// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestParliamentaryVotes } from '@maplespike/pipeline-core/parliamentary-voting';
import { applySourcePolicy, presentParliamentaryToolResult } from '@maplespike/pipeline-core';

export const getVotingRecordDefinition: ToolDefinition = {
  name: 'get_voting_record',
  description: 'Fetch House of Commons voting record for a specific division',
  inputSchema: {
    type: 'object',
    properties: {
      divisionId: {
        type: 'string',
        maxLength: 500,
        description: 'Division identifier',
      },
    },
    required: ['divisionId'],
  },
};

export const getMPVotingPatternDefinition: ToolDefinition = {
  name: 'get_mp_voting_pattern',
  description: 'Get voting pattern for a specific MP over time',
  inputSchema: {
    type: 'object',
    properties: {
      mpId: {
        type: 'string',
        maxLength: 500,
        description: 'MP identifier',
      },
      years: {
        type: 'array',
        items: { type: 'number' },
      },
    },
    required: ['mpId'],
  },
};

export const comparePartyVotingDefinition: ToolDefinition = {
  name: 'compare_party_voting',
  description: 'Compare party voting patterns for a specific division',
  inputSchema: {
    type: 'object',
    properties: {
      divisionId: {
        type: 'string',
        maxLength: 500,
        description: 'Division identifier',
      },
    },
    required: ['divisionId'],
  },
};

/** Shared runner. House and Senate votes are discovery-only. */
export async function runParliamentaryVoteTool(
  tool: string,
  fields: Record<string, unknown>,
  ingest: () => Promise<unknown> = ingestParliamentaryVotes,
): Promise<{ content: Record<string, unknown>; isError?: boolean }> {
  try {
    const result = await ingest();
    const applied = applySourcePolicy('parliamentary-voting', [result]);
    return presentParliamentaryToolResult({
      content: {
        tool,
        ...fields,
        data: applied.records[0],
        policy: applied.policy,
      },
    }, { chamber: 'commons' });
  } catch (error) {
    return presentParliamentaryToolResult({
      content: {
        tool,
        ...fields,
        error: (error as Error).message,
      },
      isError: true,
    }, { chamber: 'commons' });
  }
}

export const getVotingRecordHandler: ToolHandler = async (args) => {
  return runParliamentaryVoteTool('get_voting_record', { divisionId: args.divisionId });
};

export const getMPVotingPatternHandler: ToolHandler = async (args) => {
  return runParliamentaryVoteTool('get_mp_voting_pattern', { mpId: args.mpId, years: args.years });
};

export const comparePartyVotingHandler: ToolHandler = async (args) => {
  return runParliamentaryVoteTool('compare_party_voting', { divisionId: args.divisionId });
};