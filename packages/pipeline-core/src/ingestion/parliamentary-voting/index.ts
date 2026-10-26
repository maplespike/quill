// SPDX-License-Identifier: AGPL-3.0-only

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { fetchAllVotes } from './fetcher.js';
import { parseVoteRecords, summarizeVotes } from './parser.js';
import { PARLIAMENT_SOURCES } from './constants.js';
import type { VoteRecord, VoteSummary } from './types.js';

function makeAttribution(chamber: 'house' | 'senate') {
  const src = PARLIAMENT_SOURCES[chamber];
  return buildAttribution(src.label, {
    sourceUrl: src.url,
    attributionText: `No publisher license declaration is attached to this source configuration. Consult ${src.label} terms for the specific dataset and material.`,
  });
}

export async function ingestParliamentaryVotes() {
  const results = await fetchAllVotes();
  const houseRecords = await parseVoteRecords(results.find(r => r.chamber === 'house')?.rawVotes ?? [], 'house');
  const senateRecords = await parseVoteRecords(results.find(r => r.chamber === 'senate')?.rawVotes ?? [], 'senate');

  const houseAttribution = makeAttribution('house');
  const senateAttribution = makeAttribution('senate');

  return {
    house: withAttribution({
      chamber: 'house' as const,
      votes: houseRecords,
      summary: summarizeVotes(houseRecords),
      error: results.find(r => r.chamber === 'house')?.error,
    }, houseAttribution),
    senate: withAttribution({
      chamber: 'senate' as const,
      votes: senateRecords,
      summary: summarizeVotes(senateRecords),
      error: results.find(r => r.chamber === 'senate')?.error,
    }, senateAttribution),
  };
}

export { PARLIAMENT_SOURCES } from './constants.js';
// Aliases expected by module registry
export const ingestVotingRecords = ingestParliamentaryVotes;
export async function getMPVotingPattern() {
  const result = await ingestParliamentaryVotes();
  return result.house;
}

export type { VoteRecord, VoteSummary } from './types.js';
