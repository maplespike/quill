// SPDX-License-Identifier: AGPL-3.0-only

import type { SnzODataRecord, SnzFactRecord } from './types.js';

export function parseODataRecords(
  datasetId: string,
  datasetName: string,
  records: SnzODataRecord[],
): SnzFactRecord[] {
  const results: SnzFactRecord[] = [];
  const lastUpdated = new Date().toISOString();

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const dimensions: Record<string, string | number | null> = {};
    let value: number | null = null;
    let period = '';

    for (const [key, val] of Object.entries(rec)) {
      if (key.startsWith('@')) continue;
      const keyLower = key.toLowerCase();
      if (keyLower.includes('period') || keyLower.includes('year') || keyLower.includes('quarter') || keyLower.includes('month') || keyLower.includes('date')) {
        period = String(val ?? '');
      } else if (typeof val === 'number' && value === null) {
        value = val;
      } else if (val !== null && typeof val !== 'boolean') {
        dimensions[key] = val;
      }
    }

    results.push({
      id: `SNZ:${datasetId}:${i}`,
      dataset: datasetId,
      datasetName,
      dimensions,
      value,
      period,
      lastUpdated,
    });
  }

  return results;
}
