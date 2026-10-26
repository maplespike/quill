// SPDX-License-Identifier: AGPL-3.0-only

import type { OnsTimeseriesData, OnsFactRecord } from './types.js';

export function parseTimeseries(cdid: string, data: OnsTimeseriesData): OnsFactRecord[] {
  const records: OnsFactRecord[] = [];
  const desc = data.description;
  const lastUpdated = new Date().toISOString();

  const base = {
    series: cdid,
    seriesTitle: desc.title,
    frequency: desc.frequency ?? 'unknown',
    unit: desc.unit,
    seasonallyAdjusted: desc.seasonally_adjusted,
    lastUpdated,
  };

  for (const m of data.months ?? []) {
    const value = parseFloat(m.value);
    records.push({
      id: `ONS:${cdid}:${m.year}-${m.month}`,
      ...base,
      value: isNaN(value) ? null : value,
      period: `${m.year}-${m.month}`,
    });
  }

  for (const q of data.quarters ?? []) {
    const value = parseFloat(q.value);
    records.push({
      id: `ONS:${cdid}:${q.year}-Q${q.quarter}`,
      ...base,
      value: isNaN(value) ? null : value,
      period: `${q.year}-Q${q.quarter}`,
    });
  }

  for (const y of data.years ?? []) {
    const value = parseFloat(y.value);
    records.push({
      id: `ONS:${cdid}:${y.year}`,
      ...base,
      value: isNaN(value) ? null : value,
      period: y.year,
    });
  }

  return records;
}

export function parseMultiTimeseries(
  results: Map<string, OnsTimeseriesData>,
): OnsFactRecord[] {
  const allRecords: OnsFactRecord[] = [];
  for (const [cdid, data] of results) {
    allRecords.push(...parseTimeseries(cdid, data));
  }
  return allRecords;
}
