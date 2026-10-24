// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { buildDatasetUrl, OECD_TIMEOUT_MS, OECD_USER_AGENT, validateDatasetId } from './constants.js';
import type { OecdCsvRow } from './types.js';

export async function fetchOecdDataset(datasetId: string): Promise<string> {
  if (!validateDatasetId(datasetId)) {
    throw new Error(`Invalid dataset ID: ${datasetId}`);
  }

  const url = buildDatasetUrl(datasetId, 'csv');

  const resp = await httpGet(url, {
    timeoutMs: OECD_TIMEOUT_MS,
    headers: { 'User-Agent': OECD_USER_AGENT },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`OECD API returned HTTP ${resp.statusCode} for dataset ${datasetId}`);
  }

  return resp.body;
}

export function parseCsvData(csvText: string): OecdCsvRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: OecdCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length === headers.length) {
      const row: OecdCsvRow = {} as OecdCsvRow;
      headers.forEach((header, idx) => {
        row[header] = values[idx]?.trim().replace(/^"|"$/g, '') ?? '';
      });
      rows.push(row);
    }
  }

  return rows;
}

export function validateCsvHeaders(headers: string[]): boolean {
  const requiredHeaders = ['Country Code', 'Country', 'Indicator Code', 'Indicator Name', 'Year', 'Value'];
  return requiredHeaders.every((h) => headers.includes(h));
}