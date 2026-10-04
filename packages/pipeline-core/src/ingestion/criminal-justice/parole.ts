/**
 * Parole Board of Canada Connector — Quill
 *
 * Fetches parole decision data from the Parole Board of Canada
 * via the open.canada.ca CKAN portal.
 *
 * Data sources:
 *   - CKAN dataset for parole grant/deny rates by offence and region
 *   - Parole Board's open data publications
 *
 * Covers:
 *   - Parole decisions (Day Parole, Full Parole, TLO)
 *   - Grant/deny rates by offence category
 *   - Decisions by region
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  CRIMINAL_JUSTICE_SOURCES,
  PAROLE_DATASETS,
  CriminalJusticeFetchError,
  DEFAULT_MAX_RECORDS,
  CRIMINAL_JUSTICE_SOURCE_NAMES,
  ckanPackageUrl,
} from './constants.js';
import type { ParoleDecision, CriminalJusticeIngestionResult } from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  CSV Parser (shared with other modules)                             */


function parseCsv(content: string, hasHeader = true): string[][] {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const startIdx = hasHeader ? 1 : 0;
  return lines.slice(startIdx).map(parseCsvLine);
}

/* ------------------------------------------------------------------ */
/*  CKAN Resources Helper                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch CSV resource URLs from a CKAN dataset.
 */
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
/*  Parole Decisions Fetch                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch Parole Board decisions (grant/deny rates) by offence and region.
 */
export async function fetchParoleDecisions(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<ParoleDecision[]> {
  const records: ParoleDecision[] = [];

  try {
    const csvResources = await fetchCsvResources(PAROLE_DATASETS.DECISIONS.id);

    if (csvResources.length === 0) return records;

    const csvUrl = csvResources[0].url;
    const resp = await httpGet(csvUrl, { timeoutMs: 20_000 });
    if (resp.statusCode >= 400) return records;

    const rows = parseCsv(resp.body);
    for (const row of rows) {
      if (records.length >= maxRecords) break;
      if (row.length < 5) continue;

      try {
        const totalDecisions = parseInt(row[4], 10) || 0;
        const granted = parseInt(row[5], 10) || 0;

        records.push({
          id: await computeHash(`parole-${row.join('-')}`, 'sha256'),
          fiscalYear: row[0] ?? '',
          paroleType: row[1] ?? '',
          offenceCategory: row[2] ?? '',
          region: row[3] ?? '',
          totalDecisions,
          granted,
          denied: parseInt(row[6], 10) || 0,
          grantRate: totalDecisions > 0 ? Math.round((granted / totalDecisions) * 10000) / 100 : null,
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

/**
 * Fetch Parole Board decision data from a secondary CKAN resource if main fails.
 */
export async function fetchParoleDecisionsAlternative(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<ParoleDecision[]> {
  const records: ParoleDecision[] = [];

  try {
    const csvResources = await fetchCsvResources(PAROLE_DATASETS.PSC_DECISIONS.id);
    if (csvResources.length === 0) return records;

    const csvUrl = csvResources[0].url;
    const resp = await httpGet(csvUrl, { timeoutMs: 20_000 });
    if (resp.statusCode >= 400) return records;

    const rows = parseCsv(resp.body);
    for (const row of rows) {
      if (records.length >= maxRecords) break;
      if (row.length < 5) continue;

      try {
        const totalDecisions = parseInt(row[4], 10) || 0;
        const granted = parseInt(row[5], 10) || 0;

        records.push({
          id: await computeHash(`parole-alt-${row.join('-')}`, 'sha256'),
          fiscalYear: row[0] ?? '',
          paroleType: row[1] ?? '',
          offenceCategory: row[2] ?? '',
          region: row[3] ?? '',
          totalDecisions,
          granted,
          denied: parseInt(row[6], 10) || 0,
          grantRate: totalDecisions > 0 ? Math.round((granted / totalDecisions) * 10000) / 100 : null,
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
/*  Search Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Search parole decisions for a term.
 */
export async function searchParoleDecisions(
  query: string,
  maxResults = 10,
): Promise<ParoleDecision[]> {
  const q = query.toLowerCase();
  const decisions = await fetchParoleDecisions(maxResults * 2);
  return decisions.filter(d =>
    d.offenceCategory?.toLowerCase().includes(q) ||
    d.region?.toLowerCase().includes(q) ||
    d.paroleType?.toLowerCase().includes(q),
  ).slice(0, maxResults);
}

/**
 * Get grant rate stats from a set of parole decisions.
 */
export function computeParoleStats(
  decisions: ParoleDecision[],
): {
  total: number;
  granted: number;
  denied: number;
  overallGrantRate: number;
  byType: Record<string, { total: number; granted: number; grantRate: number }>;
  byRegion: Record<string, { total: number; granted: number; grantRate: number }>;
} {
  const total = decisions.reduce((s, d) => s + d.totalDecisions, 0);
  const granted = decisions.reduce((s, d) => s + d.granted, 0);
  const denied = decisions.reduce((s, d) => s + d.denied, 0);

  const byType: Record<string, { total: number; granted: number; grantRate: number }> = {};
  const byRegion: Record<string, { total: number; granted: number; grantRate: number }> = {};

  for (const d of decisions) {
    const t = d.paroleType || 'Unknown';
    if (!byType[t]) byType[t] = { total: 0, granted: 0, grantRate: 0 };
    byType[t].total += d.totalDecisions;
    byType[t].granted += d.granted;

    const r = d.region || 'Unknown';
    if (!byRegion[r]) byRegion[r] = { total: 0, granted: 0, grantRate: 0 };
    byRegion[r].total += d.totalDecisions;
    byRegion[r].granted += d.granted;
  }

  // Calculate grant rates
  for (const key of Object.keys(byType)) {
    byType[key].grantRate = byType[key].total > 0
      ? Math.round((byType[key].granted / byType[key].total) * 10000) / 100
      : 0;
  }
  for (const key of Object.keys(byRegion)) {
    byRegion[key].grantRate = byRegion[key].total > 0
      ? Math.round((byRegion[key].granted / byRegion[key].total) * 10000) / 100
      : 0;
  }

  return {
    total,
    granted,
    denied,
    overallGrantRate: total > 0 ? Math.round((granted / total) * 10000) / 100 : 0,
    byType,
    byRegion,
  };
}
