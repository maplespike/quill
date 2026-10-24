// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { ContributionRecord, ContributionSummary } from './types.js';

export async function parseContribution(
  raw: Record<string, unknown>,
  jurisdiction: string,
): Promise<ContributionRecord | null> {
  const donor = raw.donor ?? raw.contributorName ?? raw.name ?? raw.contributor;
  const amount = raw.amount ?? raw.contributionAmount ?? raw.amountReceived;
  const date = raw.date ?? raw.receivedDate ?? raw.contributionDate;
  const party = raw.party ?? raw.affiliation ?? raw.politicalAffiliation;

  if (!donor || !amount) return null;

  return {
    id: await computeHash(`${jurisdiction}:${String(donor)}:${String(date ?? 'unknown')}`),
    jurisdiction,
    donor: String(donor),
    amount: parseFloat(String(amount)),
    date: date ? String(date) : undefined,
    party: party ? String(party) : undefined,
    category: raw.category ? String(raw.category) : undefined,
  };
}

export async function parseContributions(
  rawDonations: Record<string, unknown>[],
  jurisdiction: string,
): Promise<ContributionRecord[]> {
  const results: ContributionRecord[] = [];
  for (const r of rawDonations) {
    const parsed = await parseContribution(r, jurisdiction);
    if (parsed) results.push(parsed);
  }
  return results;
}

export function summarizeContributions(records: ContributionRecord[]): ContributionSummary {
  const totalAmount = records.reduce((s, r) => s + r.amount, 0);

  return {
    totalContributions: records.length,
    totalAmount,
    averageAmount: records.length > 0 ? totalAmount / records.length : 0,
    maxAmount: records.length > 0 ? Math.max(...records.map(r => r.amount)) : 0,
    minAmount: records.length > 0 ? Math.min(...records.map(r => r.amount)) : 0,
  };
}
