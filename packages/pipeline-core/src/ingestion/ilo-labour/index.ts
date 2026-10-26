// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { ILO_API_BASE, ILO_INDICATORS, ILO_TOPICS, ILO_TIMEOUT_MS, ILO_USER_AGENT } from './constants.js';
import { parseIloResponse } from './parser.js';
import type { IloRecord, IloIngestionResult } from './types.js';

export async function ingestIloIndicator(indicatorCode: string, country?: string): Promise<IloIngestionResult> {
  const start = Date.now();
  const indicator = ILO_INDICATORS.find((i) => i.id === indicatorCode);
  const indicatorName = indicator?.name ?? indicatorCode;

  try {
    const params = new URLSearchParams();
    if (country) params.set('countries', country);
    params.set('format', 'json');

    const url = `${ILO_API_BASE}/indicator/${indicatorCode}?${params.toString()}`;
    const resp = await httpGet(url, {
      timeoutMs: ILO_TIMEOUT_MS,
      headers: { Accept: 'application/json', 'User-Agent': ILO_USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      return {
        datasetsAttempted: 1,
        datasetsSucceeded: 0,
        records: [],
        errors: [{ datasetId: indicatorCode, error: `HTTP ${resp.statusCode}` }],
        durationMs: Date.now() - start,
      };
    }

    const body = resp.body as any;
    const rawData = body?.data ?? [];
    const records = await parseIloResponse(rawData, indicatorCode, indicatorName);

    return {
      datasetsAttempted: 1,
      datasetsSucceeded: 1,
      records,
      errors: [],
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      datasetsAttempted: 1,
      datasetsSucceeded: 0,
      records: [],
      errors: [{ datasetId: indicatorCode, error: String(err) }],
      durationMs: Date.now() - start,
    };
  }
}

export async function ingestAllIlo(country?: string): Promise<IloIngestionResult> {
  const start = Date.now();
  const allRecords: IloRecord[] = [];
  const allErrors: Array<{ datasetId: string; error: string }> = [];
  let succeeded = 0;

  for (const indicator of ILO_INDICATORS) {
    try {
      const result = await ingestIloIndicator(indicator.id, country);
      allRecords.push(...result.records);
      if (result.datasetsSucceeded > 0) succeeded++;
      allErrors.push(...result.errors);
    } catch (err) {
      allErrors.push({ datasetId: indicator.id, error: String(err) });
    }
  }

  return {
    datasetsAttempted: ILO_INDICATORS.length,
    datasetsSucceeded: succeeded,
    records: allRecords,
    errors: allErrors,
    durationMs: Date.now() - start,
  };
}

export function searchIloRecords(records: IloRecord[], query: string): IloRecord[] {
  const lower = query.toLowerCase();
  return records.filter(
    (r) =>
      r.indicatorName.toLowerCase().includes(lower) ||
      r.indicatorCode.toLowerCase().includes(lower) ||
      r.country.toLowerCase().includes(lower) ||
      r.source.toLowerCase().includes(lower),
  );
}

export { ILO_INDICATORS, ILO_TOPICS } from './constants.js';
export type { IloRecord, IloIngestionResult } from './types.js';
