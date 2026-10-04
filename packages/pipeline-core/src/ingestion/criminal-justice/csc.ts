/**
 * CSC Connector — Quill
 *
 * Fetches Correctional Service Canada data from open.canada.ca CKAN
 * and CSC's open data portal.
 *
 * Data sources:
 *   - CKAN package_show on CSC datasets
 *   - CSC open data CSV files hosted on csc-scc.gc.ca
 *   - StatCan WDS for adult correctional statistics
 *
 * Covers:
 *   - Prison population by institution, region, security level, gender
 *   - Incidents (assaults, drug seizures, escapes, deaths)
 *   - Deaths in custody by cause
 *   - Cost per inmate by security level
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  CRIMINAL_JUSTICE_SOURCES,
  CSC_DATASETS,
  CriminalJusticeFetchError,
  DEFAULT_MAX_RECORDS,
  CRIMINAL_JUSTICE_SOURCE_NAMES,
  ckanPackageUrl,
} from './constants.js';
import type {
  CscPopulation,
  CscIncident,
  CscDeathInCustody,
  CscCostPerInmate,
  CriminalJusticeIngestionResult,
} from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  Generic CSV Parser                                                 */


function parseCsv(content: string, hasHeader = true): string[][] {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const startIdx = hasHeader ? 1 : 0;
  return lines.slice(startIdx).map(parseCsvLine);
}

/**
 * Parse CSV content using the header row for column mapping.
 * Header names are normalized to lowercase snake_case for flexible matching.
 * Returns an array of row objects keyed by normalized column name.
 */
function parseCsvWithHeaders(csvContent: string): Record<string, string>[] {
  const lines = csvContent.split('\n');
  const dataLines = lines.filter(l => l.trim().length > 0);
  if (dataLines.length < 2) return [];

  const rawHeaders = parseCsvLine(dataLines[0]);
  const headers = rawHeaders.map(h =>
    h.toLowerCase()
      .replace(/[\s\-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/^_|_$/g, ''),
  );

  const result: Record<string, string>[] = [];
  for (let i = 1; i < dataLines.length; i++) {
    const values = parseCsvLine(dataLines[i]);
    if (values.length === 0 || values.every(v => v.trim() === '')) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = idx < values.length ? values[idx].trim() : '';
    });
    result.push(row);
  }
  return result;
}

/**
 * Extract CSV download URLs from an HTML page by finding hrefs pointing to .csv files.
 * Resolves relative URLs against the page URL.
 */
function extractCsvUrlsFromHtml(html: string, pageUrl: string): string[] {
  const urls: string[] = [];
  const baseUrl = pageUrl.substring(0, pageUrl.lastIndexOf('/') + 1);
  const hrefRegex = /href\s*=\s*["']([^"']*\.csv[^"']*)["']/gi;

  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    let url = match[1].trim();
    if (url.startsWith('//')) {
      url = 'https:' + url;
    } else if (url.startsWith('/')) {
      url = 'https://www.csc-scc.gc.ca' + url;
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = baseUrl + url;
    }
    urls.push(url);
  }

  return [...new Set(urls)];
}

/* ------------------------------------------------------------------ */
/*  CKAN Metadata Fetch                                                */
/* ------------------------------------------------------------------ */

/**
 * Fetch CKAN dataset metadata to discover available resources.
 */
async function fetchCkanDatasetResources(datasetId: string): Promise<{
  name: string;
  format: string;
  url: string;
  lastModified: string;
}[]> {
  const url = ckanPackageUrl(datasetId);
  try {
    const resp = await httpGet(url, {
      headers: { Accept: 'application/json' },
      timeoutMs: 20_000,
    });
    if (resp.statusCode >= 400) throw new Error(`CKAN HTTP ${resp.statusCode}`);

    const parsed = await resp.json<{ success: boolean; result: { resources: any[] } }>();
    if (!parsed.success) throw new Error('CKAN API error');

    return parsed.result.resources.map((r: any) => ({
      name: r.name ?? '',
      format: r.format ?? '',
      url: r.url ?? '',
      lastModified: r.last_modified ?? r.created ?? '',
    }));
  } catch (err) {
    throw new CriminalJusticeFetchError(
      err instanceof Error ? err.message : String(err),
      'ckan',
      url,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  CSC Population Data                                                */
/* ------------------------------------------------------------------ */

/**
 * Fetch CSC offender population data (institutional and community).
 * Uses the CKAN dataset for resource discovery and fetches CSV resources.
 */
export async function fetchCscPopulation(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<CscPopulation[]> {
  const records: CscPopulation[] = [];

  try {
    // Try to fetch from CKAN resources
    const resources = await fetchCkanDatasetResources(CSC_DATASETS.POPULATION.id);
    const csvResources = resources.filter(r =>
      r.format.toLowerCase() === 'csv' && r.url.length > 0,
    );

    if (csvResources.length === 0) {
      // Fall back to direct CSC open data URL
      return fetchCscPopulationDirect(maxRecords);
    }

    // Fetch first available CSV resource
    const csvUrl = csvResources[0].url;
    const resp = await httpGet(csvUrl, { timeoutMs: 20_000 });
    if (resp.statusCode >= 400) return fetchCscPopulationDirect(maxRecords);

    const rows = parseCsv(resp.body);
    for (const row of rows) {
      if (records.length >= maxRecords) break;
      if (row.length < 5) continue;

      try {
        records.push({
          id: await computeHash(`csc-pop-${row.join('-')}`, 'sha256'),
          fiscalYear: row[0] ?? '',
          institution: row[1] ?? '',
          region: row[2] ?? '',
          count: parseInt(row[3], 10) || 0,
          populationType: row[4] ?? 'In Custody',
          gender: row[5] ?? 'Total',
          securityLevel: row[6] ?? null,
          sourceUrl: csvUrl,
          ingestedAt: new Date().toISOString(),
        });
      } catch {
        continue;
      }
    }
  } catch {
    // Fallback
    return fetchCscPopulationDirect(maxRecords);
  }

  return records;
}

/**
 * Fallback: direct extract from CSC open data page (scraping basic stats).
 * This is a minimal fallback when CKAN resources fail.
 */
async function fetchCscPopulationDirect(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<CscPopulation[]> {
  const records: CscPopulation[] = [];
  const sourceUrl = CRIMINAL_JUSTICE_SOURCES.CSC.POPULATION;

  try {
    const resp = await httpGet(sourceUrl, { timeoutMs: 15_000 });
    if (resp.statusCode >= 400) return records;

    // Extract CSV download URLs from the open data HTML page and parse the first CSV found
    const csvUrls = extractCsvUrlsFromHtml(resp.body, sourceUrl);
    if (csvUrls.length === 0) return records;

    const csvUrl = csvUrls[0];
    const csvResp = await httpGet(csvUrl, { timeoutMs: 20_000 });
    if (csvResp.statusCode >= 400) return records;

    const parsedRows = parseCsvWithHeaders(csvResp.body);
    for (const row of parsedRows) {
      if (records.length >= maxRecords) break;

      try {
        records.push({
          id: await computeHash(`csc-pop-${JSON.stringify(row)}`, 'sha256'),
          fiscalYear: row.fiscal_year || row.fiscalyear || row.year || row.reference_period || '',
          institution: row.institution || row.institution_name || row.institutionname || row.location || '',
          region: row.region || '',
          count: parseInt(row.count || row.population || row.number || row.total || '0', 10) || 0,
          populationType: row.population_type || row.populationtype || row.type || 'In Custody',
          gender: row.gender || 'Total',
          securityLevel: row.security_level || row.securitylevel || row.security || null,
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
/*  CSC Incidents Data                                                 */
/* ------------------------------------------------------------------ */

/**
 * Fetch institutional incident data from CSC.
 */
export async function fetchCscIncidents(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<CscIncident[]> {
  const records: CscIncident[] = [];

  try {
    const resources = await fetchCkanDatasetResources(CSC_DATASETS.INCIDENTS.id);
    const csvResources = resources.filter(r =>
      r.format.toLowerCase() === 'csv' && r.url.length > 0,
    );

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
          id: await computeHash(`csc-inc-${row.join('-')}`, 'sha256'),
          fiscalYear: row[0] ?? '',
          institution: row[1] ?? '',
          region: row[2] ?? '',
          incidentType: row[3] ?? '',
          count: parseInt(row[4], 10) || 0,
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
/*  CSC Deaths in Custody                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch deaths in federal custody data.
 */
export async function fetchCscDeaths(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<CscDeathInCustody[]> {
  const records: CscDeathInCustody[] = [];

  try {
    const resources = await fetchCkanDatasetResources(CSC_DATASETS.DEATHS.id);
    const csvResources = resources.filter(r =>
      r.format.toLowerCase() === 'csv' && r.url.length > 0,
    );

    if (csvResources.length === 0) return records;

    const csvUrl = csvResources[0].url;
    const resp = await httpGet(csvUrl, { timeoutMs: 20_000 });
    if (resp.statusCode >= 400) return records;

    const rows = parseCsv(resp.body);
    for (const row of rows) {
      if (records.length >= maxRecords) break;
      if (row.length < 3) continue;

      try {
        records.push({
          id: await computeHash(`csc-death-${row.join('-')}`, 'sha256'),
          fiscalYear: row[0] ?? '',
          causeOfDeath: row[1] ?? 'Unknown',
          gender: row[2] ?? 'Total',
          ageRange: row[3] ?? null,
          ethnicity: row[4] ?? null,
          count: parseInt(row[5] ?? '1', 10) || 1,
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
/*  CSC Cost Per Inmate                                                */
/* ------------------------------------------------------------------ */

/**
 * Fetch cost per inmate data by security level.
 */
export async function fetchCscCosts(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<CscCostPerInmate[]> {
  const records: CscCostPerInmate[] = [];

  try {
    const resources = await fetchCkanDatasetResources(CSC_DATASETS.COST_PER_INMATE.id);
    const csvResources = resources.filter(r =>
      r.format.toLowerCase() === 'csv' && r.url.length > 0,
    );

    if (csvResources.length === 0) return records;

    const csvUrl = csvResources[0].url;
    const resp = await httpGet(csvUrl, { timeoutMs: 20_000 });
    if (resp.statusCode >= 400) return records;

    const rows = parseCsv(resp.body);
    for (const row of rows) {
      if (records.length >= maxRecords) break;
      if (row.length < 3) continue;

      try {
        records.push({
          id: await computeHash(`csc-cost-${row.join('-')}`, 'sha256'),
          fiscalYear: row[0] ?? '',
          institutionType: row[1] ?? '',
          costPerInmate: parseFloat(row[2]) || 0,
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
 * Search across all CSC data for a term.
 */
export async function searchCscData(
  query: string,
  maxResults = 10,
): Promise<{
  population: CscPopulation[];
  incidents: CscIncident[];
  deaths: CscDeathInCustody[];
  costs: CscCostPerInmate[];
}> {
  const q = query.toLowerCase();
  const [population, incidents, deaths, costs] = await Promise.all([
    fetchCscPopulation(maxResults),
    fetchCscIncidents(maxResults),
    fetchCscDeaths(maxResults),
    fetchCscCosts(maxResults),
  ]);

  return {
    population: population.filter(r =>
      r.institution?.toLowerCase().includes(q) ||
      r.region?.toLowerCase().includes(q) ||
      r.populationType?.toLowerCase().includes(q),
    ).slice(0, maxResults),
    incidents: incidents.filter(r =>
      r.institution?.toLowerCase().includes(q) ||
      r.incidentType?.toLowerCase().includes(q) ||
      r.region?.toLowerCase().includes(q),
    ).slice(0, maxResults),
    deaths: deaths.filter(r =>
      r.causeOfDeath?.toLowerCase().includes(q),
    ).slice(0, maxResults),
    costs: costs.filter(r =>
      r.institutionType?.toLowerCase().includes(q),
    ).slice(0, maxResults),
  };
}
