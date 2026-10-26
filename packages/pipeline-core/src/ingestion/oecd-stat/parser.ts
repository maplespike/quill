// SPDX-License-Identifier: AGPL-3.0-only

import type { OECDIndicator } from './types.js';
import { computeHash } from '../../verification/hashing.js';

export function parseOECDObservations(
  datasetId: string,
  observations: Record<string, string[]>,
): OECDIndicator[] {
  const results: OECDIndicator[] = [];
  for (const [key, values] of Object.entries(observations)) {
    if (!values?.[0]) continue;
    const year = parseInt(key.split(':')[0] ?? '0', 10);
    const value = parseFloat(values[0]);
    if (isNaN(year) || isNaN(value)) continue;

    results.push({
      datasetId,
      datasetName: datasetId,
      indicatorCode: key,
      country: 'CAN',
      year,
      value,
      unit: '',
      id: `OECD:${datasetId}:${key}:${year}`,
    });
  }
  return results;
}
