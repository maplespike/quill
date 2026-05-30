// SPDX-License-Identifier: AGPL-3.0-or-later

import { computeHash } from '../../verification/hashing.js';
import type { HDIRecord } from './types.js';

export function classifyHDI(value: number): HDIRecord['category'] {
  if (value >= 0.800) return 'very-high';
  if (value >= 0.700) return 'high';
  if (value >= 0.550) return 'medium';
  return 'low';
}

export async function parseHDIRanking(
  countryCode: string,
  hdiValue: number | null,
  rank: number | null,
  year: number,
): Promise<HDIRecord | null> {
  if (hdiValue === null) return null;

  return {
    id: await computeHash(`UNDP:${countryCode}:${year}`),
    country: countryCode,
    countryCode,
    hdiValue,
    rank: rank ?? 0,
    year,
    category: classifyHDI(hdiValue),
  };
}

export async function parseHDIRankings(
  raw: Array<{ country_code?: string; hdi_2022?: number; rank_2022?: number }>,
  year: number,
): Promise<HDIRecord[]> {
  const results: HDIRecord[] = [];
  for (const item of raw) {
    if (!item.country_code || item.hdi_2022 == null) continue;
    const record = await parseHDIRanking(item.country_code, item.hdi_2022, item.rank_2022 ?? null, year);
    if (record) results.push(record);
  }
  return results;
}
