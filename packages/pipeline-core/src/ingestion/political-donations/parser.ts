// SPDX-License-Identifier: AGPL-3.0-only

import { createHash } from 'node:crypto';
import { donationAmountBand, donationParty } from '@maplespike/database';
import type { DonationAggregate, ContributionSummary } from './types.js';

/**
 * Fold raw contribution rows into aggregates by party, riding, and amount band.
 * A donor name on the source row is ignored and is not copied onto the result.
 */
export async function parseContributions(
  rawDonations: Record<string, unknown>[],
  jurisdiction: string,
): Promise<DonationAggregate[]> {
  const grouped = new Map<string, DonationAggregate>();
  for (const raw of rawDonations) {
    const amountRaw = raw.amount ?? raw.contributionAmount ?? raw.amountReceived;
    if (amountRaw === undefined || amountRaw === null || amountRaw === '') continue;
    const amount = parseFloat(String(amountRaw));
    if (!Number.isFinite(amount)) continue;
    const party = donationParty(raw.party ?? raw.affiliation ?? raw.politicalAffiliation ?? raw.recipient, 'party');
    const riding = String(raw.riding ?? raw.electoralDistrict ?? '').trim();
    const amountBand = donationAmountBand(amount);
    const key = `${jurisdiction}\u001f${party}\u001f${riding}\u001f${amountBand}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.contributionCount += 1;
      existing.totalAmount += amount;
      continue;
    }
    grouped.set(key, {
      id: createHash('sha256').update(key).digest('hex').slice(0, 16),
      jurisdiction,
      party,
      riding,
      amountBand,
      contributionCount: 1,
      totalAmount: amount,
    });
  }
  return [...grouped.values()];
}

export function summarizeContributions(records: DonationAggregate[]): ContributionSummary {
  const totalAmount = records.reduce((s, r) => s + r.totalAmount, 0);
  const totalContributions = records.reduce((s, r) => s + r.contributionCount, 0);
  const totals = records.map((r) => r.totalAmount);

  return {
    totalContributions,
    totalAmount,
    averageAmount: records.length > 0 ? totalAmount / totalContributions : 0,
    maxAmount: totals.length > 0 ? Math.max(...totals) : 0,
    minAmount: totals.length > 0 ? Math.min(...totals) : 0,
  };
}
