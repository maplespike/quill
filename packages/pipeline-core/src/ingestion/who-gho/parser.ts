// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { WhoGhoRecord, WhoGhoRawRecord } from './types.js';

export async function parseGhoRecord(raw: WhoGhoRawRecord): Promise<WhoGhoRecord | null> {
  // NumericValue can be number | null in the raw API response
  const numericValue = raw.NumericValue as number | null;
  
  if (
    !raw.IndicatorCode ||
    !raw.SpatialDim ||
    numericValue === null ||
    numericValue === undefined
  ) {
    return null;
  }

  const id = await computeHash(
    `WHO:${raw.IndicatorCode}:${raw.SpatialDim}:${raw.TimeDim}`,
  );

  return {
    id,
    indicatorCode: raw.IndicatorCode,
    indicatorName: raw.IndicatorName,
    countryCode: raw.SpatialDim,
    countryName: raw.SpatialDim,
    year: raw.TimeDim,
    value: numericValue,
    unit: raw.Unit,
    source: 'WHO GHO',
  };
}

export async function parseGhoRecords(raw: WhoGhoRawRecord[]): Promise<WhoGhoRecord[]> {
  const results: WhoGhoRecord[] = [];
  for (const record of raw) {
    const parsed = await parseGhoRecord(record);
    if (parsed) results.push(parsed);
  }
  return results;
}