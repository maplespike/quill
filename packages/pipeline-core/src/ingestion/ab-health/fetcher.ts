// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Alberta Health Fetcher — Quill
 *
 * Fetches Alberta Health Services (AHS) operational metrics and Alberta Health
 * publications from open.alberta.ca CKAN portal.
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 */

import { httpGet } from '../../utils/http.js';
import {
  AB_HEALTH_SOURCES,
  AB_HEALTH_TYPE_CONFIG,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type {
  AHSRecordType,
  RawAHSRecord,
  RawABHealthPublication,
  CkanSearchResponse,
  CkanApiRecord,
} from './types.js';
import type { HttpResponse } from '../../utils/http.js';

/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class ABHealthFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
    public readonly recordType?: AHSRecordType,
  ) {
    super(message);
    this.name = 'ABHealthFetchError';
  }
}

/* ------------------------------------------------------------------ */
/*  HTTP Helpers                                                       */
/* ------------------------------------------------------------------ */

async function fetchJson<T = unknown>(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new ABHealthFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

/* ------------------------------------------------------------------ */
/*  CKAN API Helpers                                                   */
/* ------------------------------------------------------------------ */

async function searchCkanPackages(
  query: string,
  options: {
    rows?: number;
    start?: number;
  } = {},
): Promise<CkanApiRecord[]> {
  const baseUrl = AB_HEALTH_SOURCES.AHS.CKAN;
  const searchParams = new URLSearchParams({
    q: query,
    rows: String(options.rows ?? 100),
    start: String(options.start ?? 0),
  });

  const url = `${baseUrl}/action/package_search?${searchParams.toString()}`;
  const data = await fetchJson<CkanSearchResponse>(url);

  if (!data.success || !data.result?.results) {
    return [];
  }

  return data.result.results;
}

/* ------------------------------------------------------------------ */
/*  AHS Metrics Fetchers                                               */
/* ------------------------------------------------------------------ */

async function fetchSurgeryMetrics(
  options: { limit?: number } = {},
): Promise<RawAHSRecord[]> {
  const records: RawAHSRecord[] = [];
  const limit = options.limit ?? AB_HEALTH_TYPE_CONFIG.surgery.defaultLimit;

  const datasets = await searchCkanPackages('surgical wait time', { rows: limit });

  for (const dataset of datasets) {
    const resource = dataset.resources?.[0];
    const sourceUrl = resource?.url ?? AB_HEALTH_SOURCES.AHS.SURGERY;

    records.push({
      category: 'surgery',
      measure: dataset.title ?? 'Surgical Wait Times',
      value: 'See source data',
      region: undefined,
      fiscalYear: undefined,
      quarter: undefined,
      sourceUrl,
      sourceSystem: 'ab-ahs-surgery',
    });
  }

  return records;
}

async function fetchEmergencyMetrics(
  options: { limit?: number } = {},
): Promise<RawAHSRecord[]> {
  const records: RawAHSRecord[] = [];
  const limit = options.limit ?? AB_HEALTH_TYPE_CONFIG.emergency.defaultLimit;

  const datasets = await searchCkanPackages('emergency department', { rows: limit });

  for (const dataset of datasets) {
    const resource = dataset.resources?.[0];
    const sourceUrl = resource?.url ?? AB_HEALTH_SOURCES.AHS.EMERGENCY;

    records.push({
      category: 'emergency',
      measure: dataset.title ?? 'Emergency Department Metrics',
      value: 'See source data',
      region: undefined,
      fiscalYear: undefined,
      quarter: undefined,
      sourceUrl,
      sourceSystem: 'ab-ahs-emergency',
    });
  }

  return records;
}

async function fetchDiagnosticMetrics(
  options: { limit?: number } = {},
): Promise<RawAHSRecord[]> {
  const records: RawAHSRecord[] = [];
  const limit = options.limit ?? AB_HEALTH_TYPE_CONFIG.diagnostic.defaultLimit;

  const datasets = await searchCkanPackages('diagnostic imaging', { rows: limit });

  for (const dataset of datasets) {
    const resource = dataset.resources?.[0];
    const sourceUrl = resource?.url ?? `${AB_HEALTH_SOURCES.AHS.BASE}/dataset`;

    records.push({
      category: 'diagnostic',
      measure: dataset.title ?? 'Diagnostic Imaging Metrics',
      value: 'See source data',
      region: undefined,
      fiscalYear: undefined,
      quarter: undefined,
      sourceUrl,
      sourceSystem: 'ab-ahs-diagnostic',
    });
  }

  return records;
}

async function fetchInpatientMetrics(
  options: { limit?: number } = {},
): Promise<RawAHSRecord[]> {
  const records: RawAHSRecord[] = [];
  const limit = options.limit ?? AB_HEALTH_TYPE_CONFIG.inpatient.defaultLimit;

  const datasets = await searchCkanPackages('inpatient care', { rows: limit });

  for (const dataset of datasets) {
    const resource = dataset.resources?.[0];
    const sourceUrl = resource?.url ?? AB_HEALTH_SOURCES.AHS.INPATIENT;

    records.push({
      category: 'inpatient',
      measure: dataset.title ?? 'Inpatient Care Metrics',
      value: 'See source data',
      region: undefined,
      fiscalYear: undefined,
      quarter: undefined,
      sourceUrl,
      sourceSystem: 'ab-ahs-inpatient',
    });
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Publications Fetcher                                               */
/* ------------------------------------------------------------------ */

async function fetchInternalABHealthPublications(
  options: { limit?: number } = {},
): Promise<RawABHealthPublication[]> {
  const records: RawABHealthPublication[] = [];
  const limit = options.limit ?? 200;

  const datasets = await searchCkanPackages('alberta health report', { rows: limit });

  for (const dataset of datasets) {
    const resource = dataset.resources?.[0];
    const url = resource?.url ?? `${AB_HEALTH_SOURCES.ALS_BASE}/dataset/${dataset.id}`;

    records.push({
      title: dataset.title ?? '',
      topic: dataset.organization?.title ?? 'Health',
      publicationDate: undefined,
      dataType: resource?.format ?? 'dataset',
      url,
      summary: dataset.notes ?? undefined,
      sourceSystem: 'ab-health',
    });
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Record-Type Dispatcher                                            */
/* ------------------------------------------------------------------ */

export async function fetchAHSData(
  recordType: AHSRecordType,
  options: { limit?: number } = {},
): Promise<{
  records: RawAHSRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawAHSRecord[] = [];
  let source = 'none';

  try {
    switch (recordType) {
      case 'surgery':
        records = await fetchSurgeryMetrics(options);
        source = 'ab-ahs-surgery';
        break;
      case 'emergency':
        records = await fetchEmergencyMetrics(options);
        source = 'ab-ahs-emergency';
        break;
      case 'diagnostic':
        records = await fetchDiagnosticMetrics(options);
        source = 'ab-ahs-diagnostic';
        break;
      case 'inpatient':
        records = await fetchInpatientMetrics(options);
        source = 'ab-ahs-inpatient';
        break;
    }
  } catch (err) {
    errors.push(`AB Health fetch failed for ${recordType}: ${(err as Error).message}`);
  }

  return { records, source, errors };
}

export async function fetchAllAHSData(
  options: { limit?: number } = {},
): Promise<{
  records: RawAHSRecord[];
  perType: Record<AHSRecordType, RawAHSRecord[]>;
  errors: string[];
}> {
  const perType: Record<string, RawAHSRecord[]> = {};
  const allRecords: RawAHSRecord[] = [];
  const allErrors: string[] = [];

  const types: AHSRecordType[] = ['surgery', 'emergency', 'diagnostic', 'inpatient'];

  for (const type of types) {
    const { records, errors } = await fetchAHSData(type, options);
    perType[type] = records;
    allRecords.push(...records);
    allErrors.push(...errors);
  }

  return {
    records: allRecords,
    perType: perType as Record<AHSRecordType, RawAHSRecord[]>,
    errors: allErrors,
  };
}

export async function fetchABHealthPublications(
  options: { limit?: number } = {},
): Promise<{
  publications: RawABHealthPublication[];
  errors: string[];
}> {
  const errors: string[] = [];
  let publications: RawABHealthPublication[] = [];

  try {
    publications = await fetchInternalABHealthPublications(options);
  } catch (err) {
    errors.push(`AB Health publications fetch failed: ${(err as Error).message}`);
  }

  return { publications, errors };
}