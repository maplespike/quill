// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { VoteRecord, VoteSummary } from './types.js';

export async function parseVoteRecord(
  raw: Record<string, unknown>,
  chamber: 'house' | 'senate',
): Promise<VoteRecord | null> {
  const voteNumber = raw.voteNumber ?? raw.number ?? raw.vote_number;
  const date = raw.date ?? raw.voteDate ?? raw.vote_date;
  const title = raw.title ?? raw.bill ?? raw.subject;
  const yeas = raw.yea ?? raw.yeas ?? raw.votesFor;
  const nays = raw.nay ?? raw.nays ?? raw.votesAgainst;
  const result = raw.result ?? raw.outcome;

  if (!voteNumber || !date || !title) return null;

  return {
    id: await computeHash(`${chamber}:${String(voteNumber)}`),
    chamber,
    voteNumber: parseInt(String(voteNumber), 10),
    date: String(date),
    title: String(title),
    yeas: parseInt(String(yeas ?? 0), 10),
    nays: parseInt(String(nays ?? 0), 10),
    result: String(result ?? 'unknown'),
  };
}

export async function parseVoteRecords(
  rawVotes: Record<string, unknown>[],
  chamber: 'house' | 'senate',
): Promise<VoteRecord[]> {
  const results: VoteRecord[] = [];
  for (const r of rawVotes) {
    const parsed = await parseVoteRecord(r, chamber);
    if (parsed) results.push(parsed);
  }
  return results;
}

export function summarizeVotes(votes: VoteRecord[]): VoteSummary {
  const passed = votes.filter(v => v.result === 'passed' || v.result === 'carried').length;
  const failed = votes.filter(v => v.result === 'defeated' || v.result === 'negatived').length;

  return {
    totalVotes: votes.length,
    passed,
    failed,
    totalYeas: votes.reduce((s, v) => s + v.yeas, 0),
    totalNays: votes.reduce((s, v) => s + v.nays, 0),
    averageYeas: votes.length > 0 ? votes.reduce((s, v) => s + v.yeas, 0) / votes.length : 0,
    averageNays: votes.length > 0 ? votes.reduce((s, v) => s + v.nays, 0) / votes.length : 0,
  };
}
