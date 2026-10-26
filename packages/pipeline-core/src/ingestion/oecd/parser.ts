// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { OecdCsvRow, OecdRecord } from './types.js';

export async function parseOecdRow(
  row: OecdCsvRow,
  datasetId: string,
  datasetName: string,
): Promise<OecdRecord | null> {
  const countryCode = row['Country Code'];
  const yearStr = row['Year'];
  const valueStr = row['Value'];

  if (!countryCode || !yearStr || !valueStr) {
    return null;
  }

  const year = parseInt(yearStr, 10);
  const value = parseFloat(valueStr);

  if (isNaN(year) || isNaN(value)) {
    return null;
  }

  const dimensions: Record<string, string> = {};
  const dimensionKeys = Object.keys(row).filter(
    (k) => !['Country Code', 'Country', 'Indicator Code', 'Indicator Name', 'Year', 'Value', 'Unit'].includes(k),
  );
  dimensionKeys.forEach((key) => {
    dimensions[key] = row[key];
  });

  const indicatorCode = row['Indicator Code'];
  const indicatorName = row['Indicator Name'];

  const id = await computeHash(`${datasetId}:${countryCode}:${indicatorCode}:${year}`);

  return {
    id,
    datasetId,
    datasetName,
    country: countryCode,
    topic: datasetId,
    indicatorCode,
    indicatorName,
    year,
    value,
    unit: row['Unit'] ?? '',
    dimensions: Object.keys(dimensions).length > 0 ? dimensions : undefined,
  };
}

export async function parseOecdRecords(
  rows: OecdCsvRow[],
  datasetId: string,
  datasetName: string,
): Promise<OecdRecord[]> {
  const records: OecdRecord[] = [];

  for (const row of rows) {
    const record = await parseOecdRow(row, datasetId, datasetName);
    if (record) {
      records.push(record);
    }
  }

  return records;
}