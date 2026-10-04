/**
 * NPRI (National Pollutant Release Inventory) Parser — Quill
 *
 * Normalizes raw NPRI records from CKAN packages and CSV resources
 * into the unified NpriRecord schema.
 *
 * Each record represents a single facility's release of a specific
 * substance in a given reporting year.
 */

import { computeHash } from '../../verification/hashing.js';
import type {
  NpriRecord,
  RawNpriRecord,
  RawNpriCkanPackage,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Field Normalization                                                */
/* ------------------------------------------------------------------ */

/**
 * Parse a numeric field that may be a string or number.
 */
function parseNumberField(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseFloat(trimmed.replace(/[^0-9.\-]/g, ''));
  return isNaN(parsed) ? null : parsed;
}

/**
 * Extract a 4-digit year from text.
 */
function extractFiscalYear(text: string | null): string | null {
  if (!text) return null;
  const yearPattern = /\b(20\d{2})\b/;
  const yearMatch = text.match(yearPattern);
  return yearMatch ? yearMatch[1] : null;
}

/**
 * Normalize a province/territory code to two-letter uppercase.
 */
function normalizeProvince(prov: string | null | undefined): string | null {
  if (!prov) return null;
  const upper = prov.trim().toUpperCase();
  // Map full names to codes
  const provinceMap: Record<string, string> = {
    'ALBERTA': 'AB',
    'BRITISH COLUMBIA': 'BC',
    'MANITOBA': 'MB',
    'NEW BRUNSWICK': 'NB',
    'NEWFOUNDLAND AND LABRADOR': 'NL',
    'NEWFOUNDLAND': 'NL',
    'NOVA SCOTIA': 'NS',
    'ONTARIO': 'ON',
    'PRINCE EDWARD ISLAND': 'PE',
    'QUEBEC': 'QC',
    'QUÉBEC': 'QC',
    'SASKATCHEWAN': 'SK',
    'NORTHWEST TERRITORIES': 'NT',
    'NUNAVUT': 'NU',
    'YUKON': 'YT',
    'YUKON TERRITORY': 'YT',
  };
  return provinceMap[upper] ?? (upper.length === 2 ? upper : null);
}

/* ------------------------------------------------------------------ */
/*  Raw NPRI Record → NpriRecord                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw NPRI record into a normalized NpriRecord.
 *
 * @param raw - Raw NPRI record from any source
 * @param options - Parsing options
 * @returns Normalized NpriRecord or null if invalid
 */
export async function parseNpriRecord(
  raw: RawNpriRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<NpriRecord | null> {
  const facilityName = raw.facilityName ?? '';
  const substanceName = raw.substanceName ?? '';
  const fiscalYear = raw.fiscalYear ?? extractFiscalYear(raw.sourceUrl ?? '') ?? '';

  // Facility name and substance are required
  if (!facilityName || !substanceName) {
    return null;
  }

  const facilityLocation = raw.facilityLocation ?? null;
  const province = normalizeProvince(raw.province);
  const substanceCas = raw.substanceCas ?? null;

  // Parse numeric fields
  const releaseAirKg = parseNumberField(raw.releaseAirKg);
  const releaseWaterKg = parseNumberField(raw.releaseWaterKg);
  const releaseLandKg = parseNumberField(raw.releaseLandKg);
  const disposalKg = parseNumberField(raw.disposalKg);
  const recyclingKg = parseNumberField(raw.recyclingKg);
  const latitude = parseNumberField(raw.latitude);
  const longitude = parseNumberField(raw.longitude);

  const reportedBy = raw.reportedBy ?? null;
  const sourceUrl = raw.sourceUrl ?? '';
  const ckanPackageId = raw.ckanPackageId ?? null;
  const ckanResourceId = raw.ckanResourceId ?? null;
  const sourceSystem = options.sourceSystem ?? raw.sourceSystem ?? 'unknown';
  const now = options.ingestedAt ?? new Date().toISOString();

  // Build content hash from normalized fields
  const contentForHash = JSON.stringify({
    facilityName,
    substanceName,
    fiscalYear,
    releaseAirKg,
    releaseWaterKg,
    releaseLandKg,
    disposalKg,
    recyclingKg,
    province,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    facilityName,
    facilityLocation,
    province,
    latitude,
    longitude,
    substanceName,
    substanceCas,
    releaseAirKg,
    releaseWaterKg,
    releaseLandKg,
    disposalKg,
    recyclingKg,
    fiscalYear,
    reportedBy,
    sourceUrl,
    ckanPackageId,
    ckanResourceId,
    sourceSystem,
    ingestedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/*  Batch Parsing                                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse a batch of raw NPRI records.
 *
 * @param rawRecords - Array of raw records from any source
 * @param options - Parsing options
 * @returns Array of parsed NpriRecords (invalid records filtered out)
 */
export async function parseNpriBatch(
  rawRecords: RawNpriRecord[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<NpriRecord[]> {
  const results: NpriRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseNpriRecord(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  CKAN Package Parser                                                */
/* ------------------------------------------------------------------ */

/**
 * Parse a CKAN package into an array of NPRI records.
 *
 * @param pkg - Raw CKAN package
 * @param options - Parsing options
 * @returns Array of parsed NpriRecords
 */
export async function parseNpriCkanPackage(
  pkg: RawNpriCkanPackage,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<NpriRecord[]> {
  const results: NpriRecord[] = [];

  const rawRecord: RawNpriRecord = {
    facilityName: pkg.title,
    substanceName: pkg.title,
    fiscalYear: extractFiscalYear(pkg.title) || extractFiscalYear(pkg.notes ?? '') || '',
    sourceUrl: `${pkg.name ? 'https://open.canada.ca/data/dataset/' + pkg.name : ''}`,
    ckanPackageId: pkg.id,
    sourceSystem: options.sourceSystem ?? 'open-canada-ckan',
  };

  const parsed = await parseNpriRecord(rawRecord, options);
  if (parsed) {
    results.push(parsed);
  }

  return results;
}
