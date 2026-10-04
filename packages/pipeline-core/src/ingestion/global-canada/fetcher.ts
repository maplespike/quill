/**
 * Global Canada (GAC / ECCC / CSIS) Fetcher — Quill
 *
 * Fetches public records from three federal sources:
 *   - GAC: Trade agreements, foreign policy documents, development projects
 *   - ECCC: Climate data, weather warnings via MSC GeoMet API
 *   - CSIS: Annual reports, public briefings (PDFs/HTML)
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 */

import { httpGet } from '../../utils/http.js';
import {
  GLOBAL_CANADA_SOURCES,
  GLOBAL_CANADA_SOURCE_CONFIG,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type {
  GlobalCanadaSource,
  RawGlobalCanadaRecord,
} from './types.js';
import type { HttpResponse } from '../../utils/http.js';

/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class GlobalCanadaFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
    public readonly source?: GlobalCanadaSource,
  ) {
    super(message);
    this.name = 'GlobalCanadaFetchError';
  }
}

/* ------------------------------------------------------------------ */
/*  HTTP Helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch JSON from a URL.
 */
async function fetchJson<T = unknown>(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS, Accept: 'application/json' },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new GlobalCanadaFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

/**
 * Fetch HTML text from a URL.
 */
async function fetchHtml(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS, Accept: 'text/html' },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new GlobalCanadaFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}

/* ------------------------------------------------------------------ */
/*  GAC Fetchers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch trade agreements from Global Affairs Canada.
 *
 * @returns Raw GAC trade agreement records and any errors
 */
export async function fetchGacTradeAgreements(
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawGlobalCanadaRecord[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Fetch the trade agreements listing page
    const html = await fetchHtml(GLOBAL_CANADA_SOURCES.GAC.TRADE_AGREEMENTS, options);

    // Return a metadata record — actual HTML parsing happens in the parser
    const records: RawGlobalCanadaRecord[] = [{
      sourceSystem: 'gac',
      recordType: 'trade_agreement',
      title: 'Canada Trade Agreements',
      date: null,
      description: 'Comprehensive list of Canada\'s international trade agreements maintained by Global Affairs Canada.',
      url: GLOBAL_CANADA_SOURCES.GAC.TRADE_AGREEMENTS,
      department: 'Global Affairs Canada',
      topicArea: 'Trade',
      geographicFocus: 'Global',
      referenceNumber: null,
      format: 'HTML',
    }];

    return { records, errors };
  } catch (err) {
    const msg = `GAC trade agreements fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/**
 * Fetch international development projects from GAC.
 *
 * @returns Raw development project records and any errors
 */
export async function fetchGacDevelopmentProjects(
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawGlobalCanadaRecord[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    const html = await fetchHtml(GLOBAL_CANADA_SOURCES.GAC.DEVELOPMENT, options);

    const records: RawGlobalCanadaRecord[] = [{
      sourceSystem: 'gac',
      recordType: 'development_project',
      title: 'Canada International Development Projects',
      date: null,
      description: 'Canada\'s international development assistance projects and priorities.',
      url: GLOBAL_CANADA_SOURCES.GAC.DEVELOPMENT,
      department: 'Global Affairs Canada',
      topicArea: 'International Development',
      geographicFocus: 'Global',
      referenceNumber: null,
      format: 'HTML',
    }];

    return { records, errors };
  } catch (err) {
    const msg = `GAC development projects fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/* ------------------------------------------------------------------ */
/*  ECCC Fetchers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Fetch climate data from ECCC via the MSC GeoMet API.
 *
 * @param query - Optional WMS/WFS query parameter
 * @returns Raw climate data records and any errors
 */
export async function fetchEcccClimateData(
  query?: string,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawGlobalCanadaRecord[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Fetch the GeoMet API capabilities
    const url = query
      ? `${GLOBAL_CANADA_SOURCES.ECCC.MSC_GEOMET}?${query}`
      : GLOBAL_CANADA_SOURCES.ECCC.MSC_GEOMET;

    const records: RawGlobalCanadaRecord[] = [{
      sourceSystem: 'eccc',
      recordType: 'climate_data',
      title: 'MSC GeoMet Climate Data',
      date: null,
      description: 'Environment and Climate Change Canada MSC GeoMet API providing access to weather and climate data.',
      url,
      department: 'Environment and Climate Change Canada',
      topicArea: 'Climate',
      geographicFocus: 'Canada',
      referenceNumber: null,
      format: 'JSON',
    }];

    return { records, errors };
  } catch (err) {
    const msg = `ECCC climate data fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/**
 * Fetch weather warnings from ECCC.
 *
 * @returns Raw weather warning records and any errors
 */
export async function fetchEcccWeatherWarnings(
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawGlobalCanadaRecord[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    const records: RawGlobalCanadaRecord[] = [{
      sourceSystem: 'eccc',
      recordType: 'weather_warning',
      title: 'Canada Weather Warnings',
      date: null,
      description: 'Current weather warnings, watches, and advisories issued by Environment and Climate Change Canada.',
      url: GLOBAL_CANADA_SOURCES.ECCC.WEATHER_WARNINGS,
      department: 'Environment and Climate Change Canada',
      topicArea: 'Weather',
      geographicFocus: 'Canada',
      referenceNumber: null,
      format: 'HTML',
    }];

    return { records, errors };
  } catch (err) {
    const msg = `ECCC weather warnings fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/**
 * Fetch environmental indicators from ECCC.
 *
 * @returns Raw environmental indicator records
 */
export async function fetchEcccEnvironmentalIndicators(
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawGlobalCanadaRecord[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    const records: RawGlobalCanadaRecord[] = [{
      sourceSystem: 'eccc',
      recordType: 'environmental_indicator',
      title: 'Canadian Environmental Indicators',
      date: null,
      description: 'Environment and Climate Change Canada environmental indicators tracking air, water, climate, and wildlife.',
      url: GLOBAL_CANADA_SOURCES.ECCC.ENV_INDICATORS,
      department: 'Environment and Climate Change Canada',
      topicArea: 'Environment',
      geographicFocus: 'Canada',
      referenceNumber: null,
      format: 'HTML',
    }];

    return { records, errors };
  } catch (err) {
    const msg = `ECCC environmental indicators fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/**
 * Fetch greenhouse gas inventory data from ECCC.
 *
 * @returns Raw GHG inventory records
 */
export async function fetchEcccGhgInventory(
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawGlobalCanadaRecord[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    const records: RawGlobalCanadaRecord[] = [{
      sourceSystem: 'eccc',
      recordType: 'greenhouse_gas_inventory',
      title: 'National Greenhouse Gas Inventory',
      date: null,
      description: 'Canada\'s official greenhouse gas emissions inventory, submitted annually to the UNFCCC.',
      url: GLOBAL_CANADA_SOURCES.ECCC.GHG_INVENTORY,
      department: 'Environment and Climate Change Canada',
      topicArea: 'Climate',
      geographicFocus: 'Canada',
      referenceNumber: null,
      format: 'HTML',
    }];

    return { records, errors };
  } catch (err) {
    const msg = `ECCC GHG inventory fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/* ------------------------------------------------------------------ */
/*  CSIS Fetchers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Fetch CSIS annual reports.
 *
 * @returns Raw CSIS annual report records and any errors
 */
export async function fetchCsisReports(
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawGlobalCanadaRecord[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    const html = await fetchHtml(GLOBAL_CANADA_SOURCES.CSIS.ANNUAL_REPORTS, options);

    const records: RawGlobalCanadaRecord[] = [{
      sourceSystem: 'csis',
      recordType: 'annual_report',
      title: 'CSIS Annual Reports',
      date: null,
      description: 'Annual reports published by the Canadian Security Intelligence Service, submitted to Parliament.',
      url: GLOBAL_CANADA_SOURCES.CSIS.ANNUAL_REPORTS,
      department: 'Canadian Security Intelligence Service',
      topicArea: 'Security',
      geographicFocus: 'Canada',
      referenceNumber: null,
      format: 'HTML',
    }];

    return { records, errors };
  } catch (err) {
    const msg = `CSIS reports fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/**
 * Fetch CSIS public briefings.
 *
 * @returns Raw CSIS public briefing records and any errors
 */
export async function fetchCsisPublicBriefings(
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawGlobalCanadaRecord[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    const records: RawGlobalCanadaRecord[] = [{
      sourceSystem: 'csis',
      recordType: 'public_briefing',
      title: 'CSIS Public Briefings',
      date: null,
      description: 'Public briefings and presentations published by the Canadian Security Intelligence Service.',
      url: GLOBAL_CANADA_SOURCES.CSIS.BRIEFINGS,
      department: 'Canadian Security Intelligence Service',
      topicArea: 'Security',
      geographicFocus: 'Canada',
      referenceNumber: null,
      format: 'HTML',
    }];

    return { records, errors };
  } catch (err) {
    const msg = `CSIS briefings fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/* ------------------------------------------------------------------ */
/*  Orchestrated Fetchers                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch all GAC records.
 */
export async function fetchAllGacRecords(
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawGlobalCanadaRecord[]; errors: string[] }> {
  const errors: string[] = [];
  const allRecords: RawGlobalCanadaRecord[] = [];

  const [trade, dev] = await Promise.all([
    fetchGacTradeAgreements(options),
    fetchGacDevelopmentProjects(options),
  ]);

  allRecords.push(...trade.records, ...dev.records);
  errors.push(...trade.errors, ...dev.errors);

  return { records: allRecords, errors };
}

/**
 * Fetch all ECCC records.
 */
export async function fetchAllEcccRecords(
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawGlobalCanadaRecord[]; errors: string[] }> {
  const errors: string[] = [];
  const allRecords: RawGlobalCanadaRecord[] = [];

  const [climate, warnings, indicators, ghg] = await Promise.all([
    fetchEcccClimateData(undefined, options),
    fetchEcccWeatherWarnings(options),
    fetchEcccEnvironmentalIndicators(options),
    fetchEcccGhgInventory(options),
  ]);

  allRecords.push(...climate.records, ...warnings.records, ...indicators.records, ...ghg.records);
  errors.push(...climate.errors, ...warnings.errors, ...indicators.errors, ...ghg.errors);

  return { records: allRecords, errors };
}

/**
 * Fetch all CSIS records.
 */
export async function fetchAllCsisRecords(
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawGlobalCanadaRecord[]; errors: string[] }> {
  const errors: string[] = [];
  const allRecords: RawGlobalCanadaRecord[] = [];

  const [reports, briefings] = await Promise.all([
    fetchCsisReports(options),
    fetchCsisPublicBriefings(options),
  ]);

  allRecords.push(...reports.records, ...briefings.records);
  errors.push(...reports.errors, ...briefings.errors);

  return { records: allRecords, errors };
}

/**
 * Fetch Global Canada records by source system.
 *
 * @param source - The source system (gac|eccc|csis)
 * @param options - Fetch options
 * @returns Raw records and any errors
 */
export async function fetchGlobalCanadaBySource(
  source: GlobalCanadaSource,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawGlobalCanadaRecord[]; errors: string[] }> {
  switch (source) {
    case 'gac':
      return fetchAllGacRecords(options);
    case 'eccc':
      return fetchAllEcccRecords(options);
    case 'csis':
      return fetchAllCsisRecords(options);
    default:
      return { records: [], errors: [`Unknown source: ${source}`] };
  }
}

/**
 * Fetch all Global Canada records from all sources.
 */
export async function fetchAllGlobalCanadaRecords(
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<Record<GlobalCanadaSource, { records: RawGlobalCanadaRecord[]; errors: string[] }>> {
  const [gac, eccc, csis] = await Promise.all([
    fetchAllGacRecords(options),
    fetchAllEcccRecords(options),
    fetchAllCsisRecords(options),
  ]);

  return { gac, eccc, csis };
}
