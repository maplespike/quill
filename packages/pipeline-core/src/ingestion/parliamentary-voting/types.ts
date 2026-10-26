// SPDX-License-Identifier: AGPL-3.0-only

export type VoteType = 'yea' | 'nay' | 'abstain' | 'pair';

export interface Division {
  id: string;
  date: Date;
  parliament: number;
  session: number;
  number: number;
  billNumber?: string;
  billTitle?: string;
  context?: string;
}

export interface MPVote {
  mpId: string;
  mpName: string;
  riding: string;
  party: string;
  divisionId: string;
  vote: VoteType;
}

export interface VoteRecord {
  id: string;
  chamber: 'house' | 'senate';
  voteNumber: number;
  date: string;
  title: string;
  yeas: number;
  nays: number;
  result: string;
}

export interface VoteSummary {
  totalVotes: number;
  passed: number;
  failed: number;
  totalYeas: number;
  totalNays: number;
  averageYeas: number;
  averageNays: number;
}