// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Private individuals are not served: donors, insiders, and 10% holders.
 * Politicians, officials, registered lobbyists, and filing executives stay.
 */

const PRIVATE_NAME_KEYS = new Set([
  'donorname',
  'donor',
  'insidername',
  'holdername',
  'beneficialowner',
  'tenpercentholder',
  'contributorname',
  'contributor',
  'individualname',
  'reportinginsider',
]);

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPrivatePersonRecord(node: unknown): boolean {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  const obj = node as Record<string, unknown>;
  const keys = Object.keys(obj).map(normalizedKey);
  if (keys.some((key) => PRIVATE_NAME_KEYS.has(key))) return true;
  const filing = String(obj.filingType ?? obj.filing_type ?? '');
  if (filing === 'insider-report' || filing === 'early-warning-report') return true;
  const relation = String(obj.insiderRelation ?? obj.insider_relation ?? '').toLowerCase();
  if (relation.includes('10%') || relation.includes('insider')) return true;
  const donorType = String(obj.donorType ?? obj.donor_type ?? '');
  return donorType === 'individual';
}

/**
 * Remove private-individual records and name fields.
 * A politician, lobbyist, official, or executive record is not private and is kept.
 */
export function stripPrivateIndividualNames<T>(value: T): T {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      return node.filter((item) => !isPrivatePersonRecord(item)).map(walk);
    }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        if (PRIVATE_NAME_KEYS.has(normalizedKey(key))) continue;
        out[key] = walk(child);
      }
      return out;
    }
    return node;
  };
  return walk(value) as T;
}
