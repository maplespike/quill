/**
 * Species at Risk Registry Parser — Quill
 *
 * Normalizes raw SARA API responses into the unified SpeciesAtRiskRecord schema.
 *
 * Each record represents a single species listing decision or recovery strategy
 * from the Species at Risk Act (SARA) registry.
 */

import { computeHash } from '../../verification/hashing.js';
import {
  SARA_STATUS_MAP,
  SARA_SOURCES,
} from './constants.js';
import type {
  SpeciesAtRiskRecord,
  SpeciesStatus,
  RawSaraSpecies,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Status Normalization                                               */
/* ------------------------------------------------------------------ */

/**
 * Normalize a raw status string to the unified SpeciesStatus type.
 *
 * @param raw - Raw status string from SARA API
 * @returns Normalized status value
 */
export function normalizeStatus(raw: string | null | undefined): SpeciesStatus {
  if (!raw) return 'data_deficient';

  const trimmed = raw.trim().toLowerCase();

  // Direct map match
  const mapped = SARA_STATUS_MAP[trimmed];
  if (mapped) return mapped;

  // Partial matching for common variants
  if (trimmed.includes('extirpated')) return 'extirpated';
  if (trimmed.includes('endangered')) return 'endangered';
  if (trimmed.includes('threatened')) return 'threatened';
  if (trimmed.includes('special concern') || trimmed.includes('special_concern')) return 'special_concern';
  if (trimmed.includes('not at risk') || trimmed.includes('not_at_risk')) return 'not_at_risk';
  if (trimmed.includes('data deficient') || trimmed.includes('data_deficient')) return 'data_deficient';

  return 'data_deficient';
}

/**
 * Parse a boolean or string-yes/no to boolean | null.
 */
function parseBoolean(value: boolean | string | null | undefined): boolean | null {
  if (typeof value === 'boolean') return value;
  if (!value) return null;
  const lower = String(value).trim().toLowerCase();
  if (lower === 'true' || lower === 'yes' || lower === 'y' || lower === '1') return true;
  if (lower === 'false' || lower === 'no' || lower === 'n' || lower === '0') return false;
  return null;
}

/* ------------------------------------------------------------------ */
/*  Raw SARA Species → SpeciesAtRiskRecord                             */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw SARA species record into a normalized SpeciesAtRiskRecord.
 *
 * @param raw - Raw SARA API species object
 * @param options - Parsing options
 * @returns Normalized SpeciesAtRiskRecord or null if invalid
 */
export async function parseSaraSpecies(
  raw: RawSaraSpecies,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<SpeciesAtRiskRecord | null> {
  const speciesName = raw.commonNameEnglish ?? raw.commonNameFrench ?? '';
  if (!speciesName) return null;

  const scientificName = raw.scientificName ?? null;
  const taxonomicGroup = raw.taxonomicGroup ?? null;
  const status = normalizeStatus(raw.status);
  const assessmentDate = raw.assessmentDate ?? null;
  const listingDate = raw.listingDate ?? null;
  const recoveryStrategyUrl = raw.recoveryStrategyUrl ?? null;
  const criticalHabitat = parseBoolean(raw.criticalHabitatIdentified);
  const provinceTerritory = raw.provinceTerritory ?? null;
  const saraSpeciesId = raw.id ?? null;
  const sourceSystem = options.sourceSystem ?? 'sara-api';
  const now = options.ingestedAt ?? new Date().toISOString();

  const detailUrl = saraSpeciesId
    ? `${SARA_SOURCES.API_BASE}/species/${saraSpeciesId}`
    : SARA_SOURCES.PORTAL;

  // Build content hash from normalized fields
  const contentForHash = JSON.stringify({
    speciesName,
    scientificName,
    taxonomicGroup,
    status,
    assessmentDate,
    listingDate,
    recoveryStrategyUrl,
    criticalHabitat,
    provinceTerritory,
    saraSpeciesId,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    speciesName,
    scientificName,
    taxonomicGroup,
    status,
    assessmentDate,
    listingDate,
    recoveryStrategyUrl,
    criticalHabitat,
    provinceTerritory,
    saraSpeciesId,
    sourceUrl: detailUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/*  Batch Parsing                                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse a batch of raw SARA species records.
 *
 * @param rawRecords - Array of raw species records from the SARA API
 * @param options - Parsing options
 * @returns Array of parsed SpeciesAtRiskRecords (invalid records filtered out)
 */
export async function parseSaraBatch(
  rawRecords: RawSaraSpecies[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<SpeciesAtRiskRecord[]> {
  const results: SpeciesAtRiskRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseSaraSpecies(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}

/**
 * Parse the full SARA API response into an array of records.
 *
 * @param json - The raw SARA API JSON response
 * @param options - Parsing options
 * @returns Array of parsed SpeciesAtRiskRecords
 */
export async function parseSaraResponse(
  json: { data?: RawSaraSpecies[] },
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<SpeciesAtRiskRecord[]> {
  if (!json.data || !Array.isArray(json.data)) {
    return [];
  }

  return parseSaraBatch(json.data, options);
}
