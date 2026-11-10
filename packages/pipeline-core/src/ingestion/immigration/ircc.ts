// SPDX-License-Identifier: AGPL-3.0-only
/**
 * IRCC Connector — Quill
 *
 * Fetches immigration, citizenship, and temporary resident data
 * from IRCC's open data portal and CKAN.
 *
 * Primary data sources:
 *   - IRCC Open Data CSV files (rounded, trend-quality data)
 *     https://www.ircc.canada.ca/opendata-donneesouvertes/data/
 *   - CKAN dataset metadata for resource discovery
 *     https://open.canada.ca/data/api/3/action/package_show?id={uuid}
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  IMMIGRATION_SOURCES,
  IRCC_DATASETS,
  IRCC_CSV_FILES,
  ImmigrationFetchError,
  DEFAULT_MAX_RECORDS,
  IMMIGRATION_SOURCE_NAMES,
} from './constants.js';
import type {
  PermanentResidentAdmission,
  StudyPermitHolder,
  WorkPermitHolder,
  CitizenshipGrant,
  ImmigrationIngestionResult,
} from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  CKAN Metadata Fetch                                                */
/* ------------------------------------------------------------------ */

/**
 * Fetch CKAN dataset metadata to discover available resources.
 * Returns resource names, formats, and download URLs.
 */
export async function fetchCkanDataset(datasetId: string): Promise<{
  id: string;
  title: string;
  resources: { name: string; format: string; url: string; lastModified: string }[];
}> {
  const url = `${IMMIGRATION_SOURCES.CKAN.SHOW}?id=${datasetId}`;
  try {
    const resp = await httpGet(url, { headers: { Accept: 'application/json' }, timeoutMs: 20_000 });
    if (resp.statusCode >= 400) throw new Error(`CKAN HTTP ${resp.statusCode}`);

    const parsed = await resp.json<{ success: boolean; result: { id: string; title: string; resources: any[] } }>();
    if (!parsed.success) throw new Error('CKAN API error');

    return {
      id: parsed.result.id,
      title: parsed.result.title,
      resources: parsed.result.resources.map((r: any) => ({
        name: r.name ?? '',
        format: r.format ?? '',
        url: r.url ?? '',
        lastModified: r.last_modified ?? r.created ?? '',
      })),
    };
  } catch (err) {
    throw new ImmigrationFetchError(
      err instanceof Error ? err.message : String(err),
      'ckan',
      url,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  IRCC Open Data CSV Parser (Generic)                                */
/* ------------------------------------------------------------------ */



/**
 * Parse IRCC-style CSV content into rows (array of field arrays).
 * Skips the header row, returns data rows.
 */
function parseIrccCsv(content: string, hasHeader = true): string[][] {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const startIdx = hasHeader ? 1 : 0;
  return lines.slice(startIdx).map(parseCsvLine);
}

/* ------------------------------------------------------------------ */
/*  IRCC CSV Fetch Helper                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch and parse an IRCC open data CSV file.
 * Returns parsed rows and the source URL.
 */
async function fetchIrccCsv(csvName: string): Promise<{
  rows: string[][];
  sourceUrl: string;
}> {
  const sourceUrl = IMMIGRATION_SOURCES.IRCC_OPENDATA.CSV(csvName);

  try {
    const resp = await httpGet(sourceUrl, { timeoutMs: 20_000 });

    if (resp.statusCode >= 400) {
      // Try the URL as-is (some are XLSX-only)
      return { rows: [], sourceUrl };
    }

    const rows = parseIrccCsv(resp.body);
    return { rows, sourceUrl };
  } catch {
    return { rows: [], sourceUrl };
  }
}

/* ------------------------------------------------------------------ */
/*  Permanent Resident Admissions                                      */
/* ------------------------------------------------------------------ */

/**
 * Fetch permanent resident admission data by province/territory
 * and immigration category. Monthly updates, CSV format.
 */
export async function fetchPermanentResidentsByProvince(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<PermanentResidentAdmission[]> {
  const { rows, sourceUrl } = await fetchIrccCsv(IRCC_CSV_FILES.PR_PROV_IMMCAT);
  const records: PermanentResidentAdmission[] = [];

  for (const row of rows) {
    if (records.length >= maxRecords) break;
    if (row.length < 4) continue;

    try {
      records.push({
        id: await computeHash(`pr-prov-${row.join('-')}`, 'sha256'),
        immigrationCategory: row[2] ?? '',
        subCategory: null,
        provinceTerritory: row[0] ?? '',
        countryOfCitizenship: null,
        year: parseInt(row[1], 10) || 0,
        month: null,
        count: parseInt(row[3], 10) || 0,
        gender: null,
        ageRange: null,
        sourceUrl,
        ckanDatasetId: IRCC_DATASETS.PERMANENT_RESIDENTS.id,
        ingestedAt: new Date().toISOString(),
      });
    } catch {
      continue;
    }
  }

  return records;
}

/**
 * Fetch permanent resident admissions by country of citizenship.
 */
export async function fetchPermanentResidentsByCitizenship(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<PermanentResidentAdmission[]> {
  const { rows, sourceUrl } = await fetchIrccCsv(IRCC_CSV_FILES.PR_PROV_CITIZEN);
  const records: PermanentResidentAdmission[] = [];

  for (const row of rows) {
    if (records.length >= maxRecords) break;
    if (row.length < 4) continue;

    try {
      records.push({
        id: await computeHash(`pr-citizen-${row.join('-')}`, 'sha256'),
        immigrationCategory: row[2] ?? '',
        subCategory: null,
        provinceTerritory: row[0] ?? '',
        countryOfCitizenship: row[3] ?? '',
        year: parseInt(row[1], 10) || 0,
        month: null,
        count: parseInt(row[4], 10) || 0,
        gender: null,
        ageRange: null,
        sourceUrl,
        ckanDatasetId: IRCC_DATASETS.PERMANENT_RESIDENTS.id,
        ingestedAt: new Date().toISOString(),
      });
    } catch {
      continue;
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Study Permit Holders                                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch study permit holder data by province/territory and citizenship.
 * Monthly updates from IRCC open data.
 */
export async function fetchStudyPermitHolders(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<StudyPermitHolder[]> {
  const { rows, sourceUrl } = await fetchIrccCsv(IRCC_CSV_FILES.STUDY_PROV_CITIZ);
  const records: StudyPermitHolder[] = [];

  for (const row of rows) {
    if (records.length >= maxRecords) break;
    if (row.length < 4) continue;

    try {
      records.push({
        id: await computeHash(`study-${row.join('-')}`, 'sha256'),
        year: parseInt(row[0], 10) || 0,
        quarter: null,
        countryOfCitizenship: row[1] ?? '',
        provinceTerritory: row[2] ?? '',
        institution: null,
        studyLevel: null,
        count: parseInt(row[3], 10) || 0,
        sourceUrl,
        ingestedAt: new Date().toISOString(),
      });
    } catch {
      continue;
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Work Permit Holders (TFWP + IMP)                                  */
/* ------------------------------------------------------------------ */

/**
 * Fetch work permit holder data — International Mobility Program (IMP).
 * Monthly updates, by province and NOC skill level.
 */
export async function fetchWorkPermitImp(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<WorkPermitHolder[]> {
  const { rows, sourceUrl } = await fetchIrccCsv(IRCC_CSV_FILES.WORK_IMP_PROV_NOC);
  const records: WorkPermitHolder[] = [];

  for (const row of rows) {
    if (records.length >= maxRecords) break;
    if (row.length < 4) continue;

    try {
      records.push({
        id: await computeHash(`work-imp-${row.join('-')}`, 'sha256'),
        year: parseInt(row[0], 10) || 0,
        quarter: null,
        programType: 'IMP',
        nocLevel: row[1] ?? '',
        countryOfCitizenship: row[2] ?? '',
        provinceTerritory: row[3] ?? '',
        count: parseInt(row[4], 10) || 0,
        sourceUrl,
        ingestedAt: new Date().toISOString(),
      });
    } catch {
      continue;
    }
  }

  return records;
}

/**
 * Fetch work permit holder data — Temporary Foreign Worker Program (TFWP).
 * Monthly updates, by province and NOC skill level.
 */
export async function fetchWorkPermitTfwp(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<WorkPermitHolder[]> {
  const { rows, sourceUrl } = await fetchIrccCsv(IRCC_CSV_FILES.WORK_TFWP_PROV_NOC);
  const records: WorkPermitHolder[] = [];

  for (const row of rows) {
    if (records.length >= maxRecords) break;
    if (row.length < 4) continue;

    try {
      records.push({
        id: await computeHash(`work-tfwp-${row.join('-')}`, 'sha256'),
        year: parseInt(row[0], 10) || 0,
        quarter: null,
        programType: 'TFWP',
        nocLevel: row[1] ?? '',
        countryOfCitizenship: row[2] ?? '',
        provinceTerritory: row[3] ?? '',
        count: parseInt(row[4], 10) || 0,
        sourceUrl,
        ingestedAt: new Date().toISOString(),
      });
    } catch {
      continue;
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Search IRCC Records (by query)                                     */
/* ------------------------------------------------------------------ */

/**
 * Search all IRCC data sources for a term.
 * Returns matching records grouped by source.
 */
export async function searchIrccData(
  query: string,
  maxResults = 10,
): Promise<{
  permanentResidents: PermanentResidentAdmission[];
  studyPermits: StudyPermitHolder[];
  workPermits: WorkPermitHolder[];
}> {
  const q = query.toLowerCase();
  const [pr, study, workImp, workTfwp] = await Promise.all([
    fetchPermanentResidentsByProvince(maxResults),
    fetchStudyPermitHolders(maxResults),
    fetchWorkPermitImp(maxResults),
    fetchWorkPermitTfwp(maxResults),
  ]);

  return {
    permanentResidents: pr.filter(r =>
      r.provinceTerritory?.toLowerCase().includes(q) ||
      r.immigrationCategory?.toLowerCase().includes(q),
    ).slice(0, maxResults),
    studyPermits: study.filter(r =>
      r.provinceTerritory?.toLowerCase().includes(q) ||
      r.countryOfCitizenship?.toLowerCase().includes(q),
    ).slice(0, maxResults),
    workPermits: [...workImp, ...workTfwp].filter(r =>
      r.provinceTerritory?.toLowerCase().includes(q) ||
      r.countryOfCitizenship?.toLowerCase().includes(q) ||
      r.nocLevel?.toLowerCase().includes(q),
    ).slice(0, maxResults),
  };
}
