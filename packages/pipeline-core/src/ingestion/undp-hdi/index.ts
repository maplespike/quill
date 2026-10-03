// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { fetchHDIRanking, fetchAllHDIRankings } from './fetcher.js';
import { parseHDIRanking, parseHDIRankings } from './parser.js';
import { DEFAULT_COUNTRIES, DEFAULT_YEAR } from './constants.js';
import type { HDIRecord, HDIIngestionResult } from './types.js';

function makeAttribution() {
  return buildAttribution('UNDP Human Development Index', {
    sourceUrl: 'https://hdr.undp.org',
    attributionText: "No publisher license declaration is attached to this source configuration. Consult UNDP terms and notices for the specific dataset and material.",
  });
}

export async function fetchHDIByCountry(countryCode: string, year?: number) {
  const attribution = makeAttribution();
  const { hdiValue, rank, error } = await fetchHDIRanking(countryCode);
  const record = parseHDIRanking(countryCode, hdiValue, rank, year ?? DEFAULT_YEAR);
  return withAttribution({ record, error }, attribution);
}

export async function fetchAllHDIData(years?: number[]) {
  const attribution = makeAttribution();
  const targets = years ?? [DEFAULT_YEAR];
  const allRecords: HDIRecord[] = [];
  const errors: string[] = [];

  for (const year of targets) {
    const rankings = await fetchAllHDIRankings();
    if (rankings.length > 0) {
      const records = parseHDIRankings(rankings, year);
      allRecords.push(...records);
    } else {
      errors.push(`No data for year ${year}`);
    }
  }

  const result: HDIIngestionResult = {
    country: 'global',
    records: allRecords,
    sourcesAttempted: targets.length,
    sourcesSucceeded: targets.length - errors.length,
    errors,
    durationMs: 0,
  };

  return withAttribution(result, attribution);
}

export type { HDIRecord, HDIIngestionResult } from './types.js';
