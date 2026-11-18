// SPDX-License-Identifier: AGPL-3.0-only
/**
 * RCMP Connector — Quill
 *
 * Fetches RCMP crime statistics data from open.canada.ca CKAN
 * and the RCMP open data portal.
 *
 * Data sources:
 *   - CKAN datasets for hate crimes, organized crime, crime severity index
 *   - StatCan WDS for detailed crime data tables
 *   - RCMP open data portal
 *
 * Covers:
 *   - Police-reported hate crime incidents by motivation and jurisdiction
 *   - Organized crime statistics by type and jurisdiction
 *   - Crime Severity Index (CSI) by jurisdiction
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  CRIMINAL_JUSTICE_SOURCES,
  RCMP_DATASETS,
  CriminalJusticeFetchError,
  DEFAULT_MAX_RECORDS,
  CRIMINAL_JUSTICE_SOURCE_NAMES,
  ckanPackageUrl,
} from './constants.js';
import type {
  RcmpHateCrime,
  RcmpOrganizedCrime,
  RcmpCrimeSeverity,
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
/*  Hate Crime Data                                                    */
/* ------------------------------------------------------------------ */

/**
 * Fetch police-reported hate crime data by motivation type and jurisdiction.
 */
export async function fetchHateCrimes(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<RcmpHateCrime[]> {
  const records: RcmpHateCrime[] = [];

  try {
    const csvResources = await fetchCsvResources(RCMP_DATASETS.HATE_CRIMES.id);

    if (csvResources.length === 0) return records;

    // Try each CSV resource until we find one that works
    for (const resource of csvResources) {
      if (records.length >= maxRecords) break;

      try {
        const resp = await httpGet(resource.url, { timeoutMs: 20_000 });
        if (resp.statusCode >= 400) continue;

        const rows = parseCsv(resp.body);
        for (const row of rows) {
          if (records.length >= maxRecords) break;
          if (row.length < 4) continue;

          try {
            const incidents = parseInt(row[3], 10) || 0;
            records.push({
              id: await computeHash(`hatecrime-${row.join('-')}`, 'sha256'),
              year: parseInt(row[0], 10) || 0,
              jurisdiction: row[1] ?? '',
              motivationType: row[2] ?? '',
              incidents,
              clearanceRate: parseFloat(row[4]) || null,
              sourceUrl: resource.url,
              ingestedAt: new Date().toISOString(),
            });
          } catch {
            continue;
          }
        }
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
/*  Organized Crime Data                                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch organized crime statistics by type and jurisdiction.
 */
export async function fetchOrganizedCrime(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<RcmpOrganizedCrime[]> {
  const records: RcmpOrganizedCrime[] = [];

  try {
    const csvResources = await fetchCsvResources(RCMP_DATASETS.ORGANIZED_CRIME.id);

    if (csvResources.length === 0) return records;

    for (const resource of csvResources) {
      if (records.length >= maxRecords) break;

      try {
        const resp = await httpGet(resource.url, { timeoutMs: 20_000 });
        if (resp.statusCode >= 400) continue;

        const rows = parseCsv(resp.body);
        for (const row of rows) {
          if (records.length >= maxRecords) break;
          if (row.length < 4) continue;

          try {
            records.push({
              id: await computeHash(`orgcrime-${row.join('-')}`, 'sha256'),
              year: parseInt(row[0], 10) || 0,
              jurisdiction: row[1] ?? '',
              crimeType: row[2] ?? '',
              incidents: parseInt(row[3], 10) || 0,
              sourceUrl: resource.url,
              ingestedAt: new Date().toISOString(),
            });
          } catch {
            continue;
          }
        }
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
/*  Crime Severity Index                                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch Crime Severity Index (CSI) data by jurisdiction.
 */
export async function fetchCrimeSeverity(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<RcmpCrimeSeverity[]> {
  const records: RcmpCrimeSeverity[] = [];

  try {
    const csvResources = await fetchCsvResources(RCMP_DATASETS.CRIME_SEVERITY.id);

    if (csvResources.length === 0) return records;

    for (const resource of csvResources) {
      if (records.length >= maxRecords) break;

      try {
        const resp = await httpGet(resource.url, { timeoutMs: 20_000 });
        if (resp.statusCode >= 400) continue;

        const rows = parseCsv(resp.body);
        for (const row of rows) {
          if (records.length >= maxRecords) break;
          if (row.length < 3) continue;

          try {
            records.push({
              id: await computeHash(`csi-${row.join('-')}`, 'sha256'),
              year: parseInt(row[0], 10) || 0,
              jurisdiction: row[1] ?? '',
              csiValue: parseFloat(row[2]) || 0,
              violentCsi: parseFloat(row[3]) || null,
              nonViolentCsi: parseFloat(row[4]) || null,
              sourceUrl: resource.url,
              ingestedAt: new Date().toISOString(),
            });
          } catch {
            continue;
          }
        }
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
 * Search across all RCMP crime data for a term.
 */
export async function searchRcmpData(
  query: string,
  maxResults = 10,
): Promise<{
  hateCrimes: RcmpHateCrime[];
  organizedCrime: RcmpOrganizedCrime[];
  crimeSeverity: RcmpCrimeSeverity[];
}> {
  const q = query.toLowerCase();
  const [hateCrimes, organizedCrime, crimeSeverity] = await Promise.all([
    fetchHateCrimes(maxResults),
    fetchOrganizedCrime(maxResults),
    fetchCrimeSeverity(maxResults),
  ]);

  return {
    hateCrimes: hateCrimes.filter(r =>
      r.jurisdiction?.toLowerCase().includes(q) ||
      r.motivationType?.toLowerCase().includes(q),
    ).slice(0, maxResults),
    organizedCrime: organizedCrime.filter(r =>
      r.jurisdiction?.toLowerCase().includes(q) ||
      r.crimeType?.toLowerCase().includes(q),
    ).slice(0, maxResults),
    crimeSeverity: crimeSeverity.filter(r =>
      r.jurisdiction?.toLowerCase().includes(q),
    ).slice(0, maxResults),
  };
}
