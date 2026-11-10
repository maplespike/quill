// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { ingestParliamentaryVotes } from '@maplespike/pipeline-core/parliamentary-voting';
import { presentParliamentaryToolResult } from '@maplespike/pipeline-core';

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

export const getVotingRecordHandler: ToolHandler = async (args) => {
  const divisionId = args.divisionId as string;

  try {
    const result = await ingestParliamentaryVotes();
    return presentParliamentaryToolResult({
      content: {
        tool: 'get_voting_record',
        divisionId,
        data: result as Record<string, unknown>,
      },
    }, { chamber: 'commons' });
  } catch (error) {
    return presentParliamentaryToolResult({
      content: {
        tool: 'get_voting_record',
        divisionId,
        error: (error as Error).message,
      },
      isError: true,
    }, { chamber: 'commons' });
  }
};

export const getMPVotingPatternHandler: ToolHandler = async (args) => {
  const mpId = args.mpId as string;
  const years = args.years as number[] | undefined;

  try {
    const result = await ingestParliamentaryVotes();
    return presentParliamentaryToolResult({
      content: {
        tool: 'get_mp_voting_pattern',
        mpId,
        years,
        data: result as Record<string, unknown>,
      },
    }, { chamber: 'commons' });
  } catch (error) {
    return presentParliamentaryToolResult({
      content: {
        tool: 'get_mp_voting_pattern',
        mpId,
        years,
        error: (error as Error).message,
      },
      isError: true,
    }, { chamber: 'commons' });
  }
};

export const comparePartyVotingHandler: ToolHandler = async (args) => {
  const divisionId = args.divisionId as string;

  try {
    const result = await ingestParliamentaryVotes();
    return presentParliamentaryToolResult({
      content: {
        tool: 'compare_party_voting',
        divisionId,
        data: result as Record<string, unknown>,
      },
    }, { chamber: 'commons' });
  } catch (error) {
    return presentParliamentaryToolResult({
      content: {
        tool: 'compare_party_voting',
        divisionId,
        error: (error as Error).message,
      },
      isError: true,
    }, { chamber: 'commons' });
  }
};