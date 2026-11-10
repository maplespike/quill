// SPDX-License-Identifier: AGPL-3.0-only
/**
 * PPSC Connector — Quill
 *
 * Fetches Public Prosecution Service of Canada caseload and outcome data
 * from the open.canada.ca CKAN portal and PPSC's annual reports.
 *
 * Data sources:
 *   - CKAN datasets for PPSC caseloads and outcomes
 *   - StatCan WDS for prosecution and court data
 *   - PPSC annual reports (PDF/HTML)
 *
 * Covers:
 *   - Caseload statistics by court level
 *   - Prosecution outcomes (convictions, acquittals, stays, withdrawals)
 *   - Stay rates (including Jordan stays)
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  CRIMINAL_JUSTICE_SOURCES,
  PPSC_DATASETS,
  CriminalJusticeFetchError,
  DEFAULT_MAX_RECORDS,
  CRIMINAL_JUSTICE_SOURCE_NAMES,
  ckanPackageUrl,
} from './constants.js';
import type {
  PpscCaseload,
  PpscOutcome,
  PpscStayRate,
  CriminalJusticeIngestionResult,
} from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  CSV Parser                                                         */


function parseCsv(content: string, hasHeader = true): string[][] {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const startIdx = hasHeader ? 1 : 0;
  return lines.slice(startIdx).map(parseCsvLine);
}

/* ------------------------------------------------------------------ */
/*  CKAN Resources Helper                                              */
/* ------------------------------------------------------------------ */

async function fetchCsvResources(datasetId: string): Promise<{ url: string; name: string }[]> {
  const url = ckanPackageUrl(datasetId);
  try {
    const resp = await httpGet(url, {
      headers: { Accept: 'application/json' },
      timeoutMs: 20_000,
    });
    if (resp.statusCode >= 400) throw new Error(`CKAN HTTP ${resp.statusCode}`);

    const parsed = await resp.json<{ success: boolean; result: { resources: any[] } }>();
    if (!parsed.success) throw new Error('CKAN API error');

    return parsed.result.resources
      .filter((r: any) => r.format?.toLowerCase() === 'csv' && r.url)
      .map((r: any) => ({ url: r.url, name: r.name ?? '' }));
  } catch (err) {
    throw new CriminalJusticeFetchError(
      err instanceof Error ? err.message : String(err),
      'ckan',
      url,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  PPSC Caseload Data                                                 */
/* ------------------------------------------------------------------ */

/**
 * Fetch PPSC caseload statistics by court level and file type.
 */
export async function fetchPpscCaseloads(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<PpscCaseload[]> {
  const records: PpscCaseload[] = [];

  try {
    const csvResources = await fetchCsvResources(PPSC_DATASETS.CASELOADS.id);

    if (csvResources.length === 0) return records;

    const csvUrl = csvResources[0].url;
    const resp = await httpGet(csvUrl, { timeoutMs: 20_000 });
    if (resp.statusCode >= 400) return records;

    const rows = parseCsv(resp.body);
    for (const row of rows) {
      if (records.length >= maxRecords) break;
      if (row.length < 4) continue;

      try {
        records.push({
          id: await computeHash(`ppsc-case-${row.join('-')}`, 'sha256'),
          fiscalYear: row[0] ?? '',
          caseloadType: row[1] ?? '',
          courtLevel: row[2] ?? '',
          fileCount: parseInt(row[3], 10) || 0,
          sourceUrl: csvUrl,
          ingestedAt: new Date().toISOString(),
        });
      } catch {
        continue;
      }
    }
  } catch {
    return records;
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  PPSC Outcome Data                                                  */
/* ------------------------------------------------------------------ */

/**
 * Fetch PPSC prosecution outcome data.
 */
export async function fetchPpscOutcomes(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<PpscOutcome[]> {
  const records: PpscOutcome[] = [];

  try {
    const csvResources = await fetchCsvResources(PPSC_DATASETS.OUTCOMES.id);

    if (csvResources.length === 0) return records;

    const csvUrl = csvResources[0].url;
    const resp = await httpGet(csvUrl, { timeoutMs: 20_000 });
    if (resp.statusCode >= 400) return records;

    const rows = parseCsv(resp.body);
    for (const row of rows) {
      if (records.length >= maxRecords) break;
      if (row.length < 4) continue;

      try {
        records.push({
          id: await computeHash(`ppsc-out-${row.join('-')}`, 'sha256'),
          fiscalYear: row[0] ?? '',
          courtLevel: row[1] ?? '',
          outcomeType: row[2] ?? '',
          count: parseInt(row[3], 10) || 0,
          sourceUrl: csvUrl,
          ingestedAt: new Date().toISOString(),
        });
      } catch {
        continue;
      }
    }
  } catch {
    return records;
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  PPSC Stay Rate Computation                                         */
/* ------------------------------------------------------------------ */

/**
 * Derive stay rates from outcome data.
 * Stay of proceedings rates are a key metric for court efficiency (R. v. Jordan).
 */
export function computeStayRates(outcomes: PpscOutcome[]): PpscStayRate[] {
  const grouped: Record<string, { totalCompleted: number; totalStays: number }> = {};

  for (const o of outcomes) {
    const key = `${o.fiscalYear}::${o.courtLevel}`;
    if (!grouped[key]) grouped[key] = { totalCompleted: 0, totalStays: 0 };

    grouped[key].totalCompleted += o.count;
    if (o.outcomeType.toLowerCase().includes('stay')) {
      grouped[key].totalStays += o.count;
    }
  }

  const result: PpscStayRate[] = [];
  for (const [key, data] of Object.entries(grouped)) {
    const [fiscalYear, courtLevel] = key.split('::');
    result.push({
      id: `stayrate-${fiscalYear}-${courtLevel}`,
      fiscalYear,
      courtLevel,
      totalCompleted: data.totalCompleted,
      totalStays: data.totalStays,
      stayRate: data.totalCompleted > 0
        ? Math.round((data.totalStays / data.totalCompleted) * 10000) / 100
        : null,
      sourceUrl: '',
      ingestedAt: new Date().toISOString(),
    });
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Search Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Search PPSC data for a term.
 */
export async function searchPpscData(
  query: string,
  maxResults = 10,
): Promise<{
  caseloads: PpscCaseload[];
  outcomes: PpscOutcome[];
}> {
  const q = query.toLowerCase();
  const [caseloads, outcomes] = await Promise.all([
    fetchPpscCaseloads(maxResults),
    fetchPpscOutcomes(maxResults),
  ]);

  return {
    caseloads: caseloads.filter(r =>
      r.courtLevel?.toLowerCase().includes(q) ||
      r.caseloadType?.toLowerCase().includes(q),
    ).slice(0, maxResults),
    outcomes: outcomes.filter(r =>
      r.outcomeType?.toLowerCase().includes(q) ||
      r.courtLevel?.toLowerCase().includes(q),
    ).slice(0, maxResults),
  };
}
