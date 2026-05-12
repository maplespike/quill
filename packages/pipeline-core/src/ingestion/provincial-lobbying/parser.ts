/**
 * Provincial Lobbying Parser — Frostbite Data Pipeline
 *
 * Normalizes provincial lobbying registry records to the federal
 * LobbyingRecord schema. This enables cross-jurisdiction queries
 * where a single company may lobby both federally and provincially
 * on the same issue.
 *
 * The primary normalization target is the federal LobbyingRecord
 * interface defined in ../corporate/types.ts.
 *
 * Each province has different field names and categories, so this
 * module provides province-specific normalization functions plus
 * a unified entry point.
 */

import { computeHash } from '../../verification/hashing.js';
import { ONTARIO_SUBJECT_MAP } from './types.js';
import type { ProvincialLobbyingRecord, Province, RawOntarioRecord } from './types.js';
import type { LobbyingRecord } from '../corporate/types.js';


/**
 * Normalize Ontario subject matters to the federal taxonomy.
 * Ontario uses different category names; this maps them to the
 * federal LOBBYING_SUBJECTS list.
 *
 * @param ontarioSubjects — Array of Ontario subject matter strings
 * @returns Array of federal subject matter strings
 */
export function normalizeOntarioSubjects(
  ontarioSubjects: string[] | undefined,
): string[] {
  if (!ontarioSubjects || ontarioSubjects.length === 0) {
    return [];
  }

  const normalized = new Set<string>();

  for (const subject of ontarioSubjects) {
    const trimmed = subject.trim();

    // Direct match in the map
    const mapped = ONTARIO_SUBJECT_MAP[trimmed];
    if (mapped) {
      mapped.forEach(s => normalized.add(s));
      continue;
    }

    // Try case-insensitive partial match
    let found = false;
    for (const [key, values] of Object.entries(ONTARIO_SUBJECT_MAP)) {
      if (key.toLowerCase() === trimmed.toLowerCase()) {
        values.forEach(s => normalized.add(s));
        found = true;
        break;
      }
    }

    if (!found) {
      // Pass through as-is if no mapping exists
      normalized.add(trimmed);
    }
  }

  return Array.from(normalized);
}


/**
 * Normalize a raw Ontario lobbying record to the unified schema.
 *
 * The Ontario registry (Integrity Commissioner of Ontario) uses
 * different field names from the federal registry. This function
 * handles the most common field mappings.
 *
 * @param raw — Raw Ontario record
 * @param options — Normalization options
 * @returns Normalized ProvincialLobbyingRecord or null (if empty/invalid)
 */
export async function normalizeOntarioRecord(
  raw: RawOntarioRecord,
  options: {
    /** Override the source system name */
    sourceSystem?: string;
    /** Override the ingested at timestamp */
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  // Extract fields with fallback keys
  // Helper: safely read a string value from unknown-typed field access
  const strField = (...keys: (keyof RawOntarioRecord | string)[]): string => {
    for (const key of keys) {
      const v = raw[key];  // RawOntarioRecord has [key: string]: unknown
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };

  // Helper: read an array field with fallback key variants
  const arrField = (...keys: (keyof RawOntarioRecord | string)[]): unknown[] => {
    for (const key of keys) {
      const v = raw[key];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const registrantName = strField('lobbyistName', 'lobbyistBusinessName', 'registrantName', 'lobbyist_name');

  const clientName = strField('clientName', 'client_name', 'Organization_Name', 'organization_name');

  const clientBusiness = strField('clientBusiness', 'client_business', 'Client_Business') || null;

  const registrantAddress = strField('lobbyistAddress', 'lobbyist_address', 'Registrant_Address') || null;

  const registrantClient = strField('lobbyistBusinessName', 'lobbyist_business_name') || null;

  // Subject matters
  const rawSubjects = arrField('subjectMatters', 'subject_matters', 'Subject_Matters', 'Subject_Matter');

  const subjectMatters = Array.isArray(rawSubjects)
    ? rawSubjects
    : typeof rawSubjects === 'string'
      ? [rawSubjects]
      : [];

  const normalizedSubjects = normalizeOntarioSubjects(subjectMatters as string[]);

  // Government bodies and officials
  const governmentBodies = arrField('governmentBodies', 'government_bodies', 'Government_Bodies');

  const officials = arrField('officials', 'Officials');

  const governmentInstitution = Array.isArray(governmentBodies)
    ? governmentBodies.join('; ')
    : typeof governmentBodies === 'string'
      ? governmentBodies
      : null;

  const publicOfficeHolder = Array.isArray(officials)
    ? officials.join('; ')
    : typeof officials === 'string'
      ? officials
      : null;

  // Dates
  const communicationDate = strField('communicationDate', 'communication_date', 'Communication_Date',
    'registrationStartDate', 'registration_start_date', 'Registration_Date');

  const startDate = strField('registrationStartDate', 'registration_start_date', 'Registration_Start_Date') || null;

  const endDate = strField('registrationEndDate', 'registration_end_date', 'Registration_End_Date') || null;

  // Lobbyist type
  const category = strField('lobbyistCategory', 'lobbyist_category', 'Lobbyist_Category');

  const lobbyistType = determineLobbyistType(category);

  // Source URL
  const sourceUrl = strField('sourceUrl', 'source_url', 'Source_URL');

  // Original Ontario registration number
  const originalId = strField('registrationNumber', 'registration_number', 'Registration_Number') || null;

  // Skip empty records
  if (!registrantName && !clientName) {
    return null;
  }

  const now = options.ingestedAt ?? new Date().toISOString();
  const sourceSystem = options.sourceSystem ?? 'ontario-registry';

  // Build content hash from normalized fields
  const contentForHash = JSON.stringify({
    registrantName,
    clientName,
    clientBusiness,
    governmentInstitution,
    publicOfficeHolder,
    communicationDate,
    startDate,
    endDate,
    normalizedSubjects,
    lobbyistType,
    province: 'ON',
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    province: 'ON',

    registrantName,
    registrantClient,
    registrantAddress,

    clientName,
    clientBusiness,

    subjectMatter: normalizedSubjects,

    governmentInstitution,
    publicOfficeHolder,

    communicationDate,
    startDate,
    endDate,

    lobbyingCostCad: null,
    lobbyistType,

    sourceUrl,
    ingestedAt: now,

    originalId,
    sourceSystem,
  };
}


/**
 * Determine the lobbyist type from an Ontario category string.
 *
 * Ontario categories include:
 *   - "Consultant Lobbyist" → consultant
 *   - "In-House Lobbyist" → in-house
 *   - "Organization" → organization
 */
function determineLobbyistType(
  category: string,
): 'consultant' | 'in-house' | 'organization' {
  const lower = category.toLowerCase();

  if (lower.includes('consultant')) return 'consultant';
  if (lower.includes('in-house') || lower.includes('in house')) return 'in-house';
  if (lower.includes('organization') || lower.includes('organisation')) return 'organization';

  // Default based on presence of business name
  return 'consultant';
}


/**
 * Normalize any provincial raw record to the unified schema.
 * Dispatches to the province-specific normalizer based on the
 * province code.
 *
 * @param province — The province code
 * @param raw — The raw record (province-specific shape)
 * @param options — Normalization options
 * @returns Normalized record or null
 */
export async function normalizeToFederalSchema(
  province: Province,
  raw: RawOntarioRecord | Record<string, unknown>,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  switch (province) {
    case 'ON':
      return normalizeOntarioRecord(raw as RawOntarioRecord, options);
    // Future provinces:
    // case 'BC':
    //   return normalizeBCRecord(raw as RawBCRecord, options);
    // case 'AB':
    //   return normalizeAlbertaRecord(raw as RawAlbertaRecord, options);
    // case 'QC':
    //   return normalizeQuebecRecord(raw as RawQuebecRecord, options);
    default:
      console.warn(`[ProvincialLobbying] No normalizer for province: ${province}`);
      return null;
  }
}

/**
 * Normalize a batch of raw records for a given province.
 */
export async function normalizeBatch(
  province: Province,
  rawRecords: RawOntarioRecord[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord[]> {
  const results: ProvincialLobbyingRecord[] = [];

  for (const raw of rawRecords) {
    const normalized = await normalizeToFederalSchema(province, raw, options);
    if (normalized !== null) {
      results.push(normalized);
    }
  }

  return results;
}

/**
 * Convert a ProvincialLobbyingRecord to the federal LobbyingRecord type
 * (dropping province-specific fields).
 */
export function toFederalRecord(
  provincial: ProvincialLobbyingRecord,
): LobbyingRecord {
  const { province, originalId, sourceSystem, ...federal } = provincial;
  return federal;
}
