// SPDX-License-Identifier: AGPL-3.0-only
import type { CorporateFiling } from './types.js';
export function searchCorporations(records: CorporateFiling[], query: string): CorporateFiling[] {
  const q = query.toLowerCase();
  return records.filter(r => r.corporationName.toLowerCase().includes(q) || r.corporationNumber.includes(q));
}
export function getByStatus(records: CorporateFiling[], status: string): CorporateFiling[] {
  return records.filter(r => r.status.toLowerCase() === status.toLowerCase());
}
