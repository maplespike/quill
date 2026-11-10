// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Global Canada (GAC / ECCC / CSIS) Parser — Quill
 *
 * Normalizes raw records from Global Affairs Canada, ECCC, and CSIS
 * into the unified GlobalCanadaRecord schema.
 *
 * Each record is assigned a SHA-256 content hash for deduplication.
 */

import { computeHash } from '../../verification/hashing.js';
import {
  GLOBAL_CANADA_SOURCES,
  GLOBAL_CANADA_SOURCE_CONFIG,
  GLOBAL_CANADA_RECORD_TYPE_MAP,
} from './constants.js';
import type {
  GlobalCanadaRecord,
  GlobalCanadaSource,
  GlobalCanadaRecordType,
  RawGlobalCanadaRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Normalization Helpers                                              */
/* ------------------------------------------------------------------ */

/**
 * Normalize a raw source system string to GlobalCanadaSource.
 */
export function normalizeSource(
  raw: string | null | undefined,
): GlobalCanadaSource {
  if (!raw) return 'gac';

  const trimmed = raw.trim().toLowerCase();
  switch (trimmed) {
    case 'gac':
    case 'global affairs':
    case 'global affairs canada':
      return 'gac';
    case 'eccc':
    case 'environment':
    case 'environment and climate change':
    case 'environment and climate change canada':
      return 'eccc';
    case 'csis':
    case 'security':
    case 'canadian security intelligence service':
      return 'csis';
    default:
      return 'gac';
  }
}

/**
 * Normalize a raw record type string to GlobalCanadaRecordType.
 */
export function normalizeRecordType(
  raw: string | null | undefined,
): GlobalCanadaRecordType {
  if (!raw) return 'other';

  const trimmed = raw.trim().toLowerCase();

  const mapped = GLOBAL_CANADA_RECORD_TYPE_MAP[trimmed];
  if (mapped) return mapped;

  // Partial matching
  if (trimmed.includes('trade') || trimmed.includes('agreement')) return 'trade_agreement';
  if (trimmed.includes('foreign') || trimmed.includes('policy')) return 'foreign_policy';
  if (trimmed.includes('development') || trimmed.includes('project')) return 'development_project';
  if (trimmed.includes('assistance') || trimmed.includes('aid')) return 'international_assistance';
  if (trimmed.includes('sanction')) return 'sanctions';
  if (trimmed.includes('treaty')) return 'treaty';
  if (trimmed.includes('climate') || trimmed.includes('temperature')) return 'climate_data';
  if (trimmed.includes('warning') || trimmed.includes('alert')) return 'weather_warning';
  if (trimmed.includes('indicator') || trimmed.includes('environment')) return 'environmental_indicator';
  if (trimmed.includes('ghg') || trimmed.includes('greenhouse') || trimmed.includes('emission')) return 'greenhouse_gas_inventory';
  if (trimmed.includes('adaptation') || trimmed.includes('resilience')) return 'climate_adaptation';
  if (trimmed.includes('forecast')) return 'weather_forecast';
  if (trimmed.includes('annual') || trimmed.includes('report')) return 'annual_report';
  if (trimmed.includes('briefing')) return 'public_briefing';
  if (trimmed.includes('advisory') || trimmed.includes('security')) return 'security_advisory';

  return 'other';
}

/**
 * Get department name from source.
 */
function getDepartment(source: GlobalCanadaSource): string {
  return GLOBAL_CANADA_SOURCE_CONFIG[source]?.department ?? 'Government of Canada';
}

/* ------------------------------------------------------------------ */
/*  Parsers by Source                                                  */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw GAC record (trade agreement, development project, etc.).
 */
export async function parseGacRecord(
  raw: RawGlobalCanadaRecord,
  options: {
    ingestedAt?: string;
  } = {},
): Promise<GlobalCanadaRecord | null> {
  const title = raw.title ?? '';
  if (!title) return null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const recordType = normalizeRecordType(raw.recordType);
  const date = raw.date ?? null;
  const description = raw.description ?? null;
  const url = raw.url ?? GLOBAL_CANADA_SOURCES.GAC.PORTAL;
  const department = raw.department ?? 'Global Affairs Canada';
  const topicArea = raw.topicArea ?? null;
  const geographicFocus = raw.geographicFocus ?? null;
  const referenceNumber = raw.referenceNumber ?? null;
  const format = raw.format ?? 'HTML';

  const contentForHash = JSON.stringify({
    title,
    recordType,
    date,
    description,
    url,
    department,
    topicArea,
    geographicFocus,
    referenceNumber,
    format,
    sourceSystem: 'gac',
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    sourceSystem: 'gac',
    recordType,
    title,
    date,
    description,
    url,
    department,
    topicArea,
    geographicFocus,
    referenceNumber,
    format,
    ingestedAt: now,
  };
}

/**
 * Parse a raw ECCC record (climate data, weather warning, etc.).
 */
export async function parseEcccRecord(
  raw: RawGlobalCanadaRecord,
  options: {
    ingestedAt?: string;
  } = {},
): Promise<GlobalCanadaRecord | null> {
  const title = raw.title ?? '';
  if (!title) return null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const recordType = normalizeRecordType(raw.recordType);
  const date = raw.date ?? null;
  const description = raw.description ?? null;
  const url = raw.url ?? GLOBAL_CANADA_SOURCES.ECCC.PORTAL;
  const department = raw.department ?? 'Environment and Climate Change Canada';
  const topicArea = raw.topicArea ?? null;
  const geographicFocus = raw.geographicFocus ?? null;
  const referenceNumber = raw.referenceNumber ?? null;
  const format = raw.format ?? 'HTML';

  const contentForHash = JSON.stringify({
    title,
    recordType,
    date,
    description,
    url,
    department,
    topicArea,
    geographicFocus,
    referenceNumber,
    format,
    sourceSystem: 'eccc',
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    sourceSystem: 'eccc',
    recordType,
    title,
    date,
    description,
    url,
    department,
    topicArea,
    geographicFocus,
    referenceNumber,
    format,
    ingestedAt: now,
  };
}

/**
 * Parse raw CSIS HTML/scraped records (annual reports, public briefings).
 */
export async function parseCsisHtml(
  raw: RawGlobalCanadaRecord,
  options: {
    ingestedAt?: string;
    html?: string;
  } = {},
): Promise<GlobalCanadaRecord | null> {
  const title = raw.title ?? '';
  if (!title) return null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const recordType = normalizeRecordType(raw.recordType);
  const date = raw.date ?? null;
  const description = raw.description ?? null;
  const url = raw.url ?? GLOBAL_CANADA_SOURCES.CSIS.PORTAL;
  const department = raw.department ?? 'Canadian Security Intelligence Service';
  const topicArea = raw.topicArea ?? null;
  const geographicFocus = raw.geographicFocus ?? null;
  const referenceNumber = raw.referenceNumber ?? null;
  const format = raw.format ?? 'PDF';

  const contentForHash = JSON.stringify({
    title,
    recordType,
    date,
    description,
    url,
    department,
    topicArea,
    geographicFocus,
    referenceNumber,
    format,
    sourceSystem: 'csis',
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    sourceSystem: 'csis',
    recordType,
    title,
    date,
    description,
    url,
    department,
    topicArea,
    geographicFocus,
    referenceNumber,
    format,
    ingestedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/*  Dispatch Parser                                                    */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw Global Canada record, dispatching to the correct source-specific parser.
 *
 * @param raw - Raw record from any Global Canada source
 * @param options - Parsing options
 * @returns Normalized GlobalCanadaRecord or null if invalid
 */
export async function parseGlobalCanadaRecord(
  raw: RawGlobalCanadaRecord,
  options: {
    sourceSystem?: GlobalCanadaSource;
    ingestedAt?: string;
    html?: string;
  } = {},
): Promise<GlobalCanadaRecord | null> {
  const source = options.sourceSystem ?? normalizeSource(raw.sourceSystem);

  switch (source) {
    case 'gac':
      return parseGacRecord(raw, options);
    case 'eccc':
      return parseEcccRecord(raw, options);
    case 'csis':
      return parseCsisHtml(raw, options);
    default:
      return parseGacRecord(raw, options);
  }
}

/* ------------------------------------------------------------------ */
/*  Batch Parsing                                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse a batch of raw Global Canada records.
 *
 * @param rawRecords - Array of raw records from Global Canada sources
 * @param options - Parsing options
 * @returns Array of parsed GlobalCanadaRecords (invalid records filtered out)
 */
export async function parseGlobalCanadaBatch(
  rawRecords: RawGlobalCanadaRecord[],
  options: {
    sourceSystem?: GlobalCanadaSource;
    ingestedAt?: string;
  } = {},
): Promise<GlobalCanadaRecord[]> {
  const results: GlobalCanadaRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseGlobalCanadaRecord(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}
