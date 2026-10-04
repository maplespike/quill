/**
 * CMHC (Canada Mortgage and Housing Corporation) Parser — Quill
 *
 * Normalizes raw CMHC housing market data records into the unified
 * CmhcRecord schema.
 *
 * Each record is assigned a SHA-256 content hash for deduplication.
 */

import { computeHash } from '../../verification/hashing.js';
import {
  CMHC_METRIC_TYPE_MAP,
  CMHC_HOUSING_TYPE_MAP,
  CMHC_SOURCES,
} from './constants.js';
import type {
  CmhcRecord,
  CmhcMetric,
  CmhcHousingType,
  RawCmhcRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Normalization Helpers                                              */
/* ------------------------------------------------------------------ */

/**
 * Normalize a raw metric type string to CmhcMetric.
 */
export function normalizeCmhcMetric(
  raw: string | null | undefined,
): CmhcMetric {
  if (!raw) return 'other';

  const trimmed = raw.trim().toLowerCase();

  const mapped = CMHC_METRIC_TYPE_MAP[trimmed];
  if (mapped) return mapped;

  return 'other';
}

/**
 * Normalize a raw housing type string to CmhcHousingType.
 */
export function normalizeCmhcHousingType(
  raw: string | null | undefined,
): CmhcHousingType {
  if (!raw) return 'all';

  const trimmed = raw.trim().toLowerCase();

  const mapped = CMHC_HOUSING_TYPE_MAP[trimmed];
  if (mapped) return mapped;

  return 'all';
}

/**
 * Parse a numeric value from a raw input.
 */
function parseNumericValue(
  raw: number | string | null | undefined,
): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw).trim().replace(/[,$%\s]/g, '');
  if (cleaned === '' || cleaned === '..' || cleaned === '...') return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse a boolean-like value.
 */
function parseBoolean(raw: boolean | string | null | undefined): boolean | null {
  if (typeof raw === 'boolean') return raw;
  if (!raw) return null;
  const lower = String(raw).trim().toLowerCase();
  if (lower === 'true' || lower === 'yes' || lower === 'y' || lower === '1') return true;
  if (lower === 'false' || lower === 'no' || lower === 'n' || lower === '0') return false;
  return null;
}

/**
 * Infer geographic level from area name.
 */
function inferGeographicLevel(area: string | null | undefined): string {
  if (!area) return 'unknown';
  const lower = area.toLowerCase().trim();

  if (lower === 'canada' || lower === 'national') return 'national';
  if (lower.includes('cma') || lower.includes('census metropolitan')) return 'cma';
  if (lower.includes('ca ') || lower.includes('census agglomeration')) return 'ca';
  if (['nl', 'pe', 'ns', 'nb', 'qc', 'on', 'mb', 'sk', 'ab', 'bc', 'yt', 'nt', 'nu']
    .includes(lower)) return 'province';

  return 'city';
}

/* ------------------------------------------------------------------ */
/*  Raw CMHC Record → CmhcRecord                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw CMHC record into a normalized CmhcRecord.
 *
 * @param raw - Raw CMHC record object
 * @param options - Parsing options
 * @returns Normalized CmhcRecord or null if invalid
 */
export async function parseCmhcDataset(
  raw: RawCmhcRecord,
  options: {
    sourceSystem?: string;
    metricType?: CmhcMetric;
    ingestedAt?: string;
  } = {},
): Promise<CmhcRecord | null> {
  const metricName = raw.metricName ?? '';
  if (!metricName) return null;

  const metricType = options.metricType ?? normalizeCmhcMetric(raw.metricType);
  const geographicArea = raw.geographicArea ?? 'Unknown';
  const geographicLevel = raw.geographicLevel ?? inferGeographicLevel(geographicArea);
  const period = raw.period ?? 'unknown';
  const housingType = normalizeCmhcHousingType(raw.housingType);
  const sourceSystem = options.sourceSystem ?? `cmhc-${metricType}`;
  const now = options.ingestedAt ?? new Date().toISOString();

  const value = parseNumericValue(raw.value);
  const unit = raw.unit ?? null;
  const seasonallyAdjusted = parseBoolean(raw.seasonallyAdjusted);
  const periodStart = raw.periodStart ?? null;
  const periodEnd = raw.periodEnd ?? null;

  const sourceUrl = raw.sourceUrl ?? CMHC_SOURCES.PORTAL;

  // Build content hash from normalized fields
  const contentForHash = JSON.stringify({
    metricName,
    metricType,
    geographicArea,
    geographicLevel,
    period,
    periodStart,
    periodEnd,
    value,
    unit,
    housingType,
    seasonallyAdjusted,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    metricName,
    metricType,
    geographicArea,
    geographicLevel,
    period,
    periodStart,
    periodEnd,
    value,
    unit,
    housingType,
    seasonallyAdjusted,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

/**
 * Parse an array of CSV-style records from CMHC into CmhcRecords.
 * Each row is an object with column headers as keys.
 */
export async function parseCmhcCsvRows(
  rows: Array<Record<string, string | number | null | undefined>>,
  options: {
    sourceSystem?: string;
    metricType?: CmhcMetric;
    year?: number;
  } = {},
): Promise<CmhcRecord[]> {
  const results: CmhcRecord[] = [];
  const now = new Date().toISOString();

  for (const row of rows) {
    const raw: RawCmhcRecord = {
      metricName: (row['Metric'] ?? row['Indicator'] ?? row['metric'] ?? undefined) as string | undefined,
      metricType: options.metricType,
      geographicArea: (row['Geography'] ?? row['Area'] ?? row['geo'] ?? row['CMA'] ?? 'Unknown') as string,
      period: (row['Period'] ?? row['Year'] ?? row['period'] ?? options.year ?? 'unknown') as string,
      value: (row['Value'] ?? row['value'] ?? row['VALUE'] ?? null) as number | string | null | undefined,
      unit: (row['Unit'] ?? row['unit'] ?? null) as string | null | undefined,
      housingType: (row['Type'] ?? row['Housing Type'] ?? row['housing_type'] ?? 'all') as string,
      seasonallyAdjusted: (row['Seasonal'] ?? row['seasonally_adjusted'] ?? null) as boolean | string | null | undefined,
      sourceUrl: CMHC_SOURCES.PORTAL,
    };

    const parsed = await parseCmhcDataset(raw, {
      sourceSystem: options.sourceSystem,
      metricType: options.metricType,
      ingestedAt: now,
    });

    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}
