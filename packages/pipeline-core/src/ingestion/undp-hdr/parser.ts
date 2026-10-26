// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import { UNDP_HDR_INDICATORS, UNDP_API_BASE } from './constants.js';
import type { UndpRecord, UndpApiRow } from './types.js';

export function parseHdrResponse(
  rows: UndpApiRow[],
  indicatorCode: string,
): UndpRecord[] {
  const indicator = UNDP_HDR_INDICATORS.find((i) => i.code === indicatorCode);
  if (!indicator) {
    throw new Error(`Unknown indicator code: ${indicatorCode}`);
  }

  const records: UndpRecord[] = [];
  const now = new Date().toISOString();

  for (const row of rows) {
    const countryCode = row.country_code?.trim().toUpperCase();
    const countryName = row.country_name?.trim();
    const year = parseYear(row.year);
    const value = parseNumeric(row.value);
    const rank = parseNumeric(row.rank);
    const rankCount = parseNumeric(row.rank_count);

    if (!countryCode || !countryName || !year) {
      continue;
    }

    const content = JSON.stringify({
      indicatorCode,
      countryCode,
      countryName,
      year,
      value,
      rank,
      rankCount,
    });

    const id = String(computeHash(content, 'sha256'));

    records.push({
      id,
      indicatorCode,
      indicatorName: indicator.name,
      countryCode,
      countryName,
      year,
      value,
      rank,
      rankCount,
      ingestedAt: now,
      sourceUrl: `${UNDP_API_BASE}/${indicatorCode.toLowerCase()}`,
    });
  }

  return records;
}

function parseYear(year: number | string | undefined): number | null {
  if (year === undefined || year === null || year === '') {
    return null;
  }

  if (typeof year === 'number') {
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return null;
    }
    return year;
  }

  const parsed = parseInt(String(year), 10);
  if (isNaN(parsed) || parsed < 1900 || parsed > 2100) {
    return null;
  }

  return parsed;
}

function parseNumeric(value: number | string | null | undefined): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      return null;
    }
    return value;
  }

  const parsed = parseFloat(String(value));
  if (isNaN(parsed) || !isFinite(parsed)) {
    return null;
  }

  return parsed;
}