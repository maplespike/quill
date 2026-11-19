// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Donation rows are aggregates. They do not name a donor.
 * Bands follow the common disclosure cut at $200, then $1,000 and $2,000.
 */

export function donationAmountBand(amount: number): string {
  if (!Number.isFinite(amount) || amount < 200) return '0-199';
  if (amount < 1000) return '200-999';
  if (amount < 2000) return '1000-1999';
  return '2000+';
}

/** Party name only when the recipient is a party. Candidate names are not kept. */
export function donationParty(recipientName: unknown, recipientType: unknown): string {
  const type = String(recipientType ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (type === 'party' || type === 'politicalparty') {
    const name = String(recipientName ?? '').trim();
    return name || 'unspecified';
  }
  return 'unspecified';
}

export interface StoredDonationAggregate {
  id: string;
  party: string;
  riding: string;
  amount_band: string;
  contribution_count: number;
  total_amount: number;
  jurisdiction: string | null;
  source: string;
}

export function aggregateDonationRows(rows: Record<string, unknown>[]): StoredDonationAggregate[] {
  const grouped = new Map<string, StoredDonationAggregate>();
  for (const row of rows) {
    const amount = Number(row.amount ?? row.total_amount ?? 0);
    const party = donationParty(row.recipient_name ?? row.party, row.recipient_type ?? 'party');
    const riding = String(row.riding ?? '').trim();
    const band = typeof row.amount_band === 'string' ? row.amount_band : donationAmountBand(amount);
    const jurisdiction = String(row.province ?? row.jurisdiction ?? '').trim();
    const source = String(row.source ?? 'unknown');
    const count = Number(row.contribution_count ?? 1);
    const key = [party, riding, band, jurisdiction, source].join('\u001f');
    const existing = grouped.get(key);
    if (existing) {
      existing.contribution_count += Number.isFinite(count) ? count : 1;
      existing.total_amount += Number.isFinite(amount) ? amount : 0;
      continue;
    }
    grouped.set(key, {
      id: `donation-agg-${stableId(key)}`,
      party,
      riding,
      amount_band: band,
      contribution_count: Number.isFinite(count) ? count : 1,
      total_amount: Number.isFinite(amount) ? amount : 0,
      jurisdiction: jurisdiction || null,
      source,
    });
  }
  return [...grouped.values()];
}

function stableId(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
