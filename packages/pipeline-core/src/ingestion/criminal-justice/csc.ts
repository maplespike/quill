/**
 * CSC Connector — MapleSpike Pipeline
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

/* ------------------------------------------------------------------ */
/*  Generic CSV Parser                                                 */
/* ------------------------------------------------------------------ */

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(content: string, hasHeader = true): string[][] {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const startIdx = hasHeader ? 1 : 0;
  return lines.slice(startIdx).map(parseCsvLine);
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

    // Return empty array — real data needs CSV parsing from known patterns
    // This is a stub for future enhancement
    return records;
  } catch {
    return records;
  }
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
