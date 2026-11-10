// SPDX-License-Identifier: AGPL-3.0-only

/** Aggregate only. No donor name is stored or returned. */
export interface DonationAggregate {
  id: string;
  jurisdiction: string;
  party: string;
  riding: string;
  amountBand: string;
  contributionCount: number;
  totalAmount: number;
}

export const JURISDICTIONS = [
  'BC',
  'Ontario',
  'Quebec',
  'Alberta',
  'Saskatchewan',
  'Manitoba',
  'New Brunswick',
  'Nova Scotia',
  'PEI',
  'Newfoundland and Labrador',
  'Yukon',
  'Northwest Territories',
  'Nunavut',
];

export interface ContributionSummary {
  totalContributions: number;
  totalAmount: number;
  averageAmount: number;
  maxAmount: number;
  minAmount: number;
}
