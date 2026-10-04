/**
 * Provincial Lobbying Parser — Quill
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
import type { ProvincialLobbyingRecord, Province, RawOntarioRecord, RawBCRecord, RawAlbertaRecord, RawQuebecRecord, RawSaskatchewanRecord, RawManitobaRecord, RawNovaScotiaRecord, RawNewBrunswickRecord, RawNewfoundlandRecord, RawPEIRecord, RawYukonRecord, RawNWTRecord, RawNunavutRecord } from './types.js';
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
 * Normalize a raw BC lobbying record to the unified schema.
 *
 * The BC registry (Office of the Registrar of Lobbyists) schema is
 * similar to Ontario's. This function handles the field mappings.
 */
export async function normalizeBCRecord(
  raw: RawBCRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  const strField = (...keys: (keyof RawBCRecord | string)[]): string => {
    for (const key of keys) {
      const v = raw[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };

  const arrField = (...keys: (keyof RawBCRecord | string)[]): unknown[] => {
    for (const key of keys) {
      const v = raw[key];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const registrantName = strField('lobbyistName', 'lobbyistBusinessName', 'registrantName', 'lobbyist_name');
  const clientName = strField('clientName', 'client_name', 'Organization_Name', 'organization_name');

  if (!registrantName && !clientName) {
    return null;
  }

  const clientBusiness = strField('clientBusiness', 'client_business', 'Client_Business') || null;
  const registrantAddress = strField('lobbyistAddress', 'lobbyist_address', 'Registrant_Address') || null;
  const registrantClient = strField('lobbyistBusinessName', 'lobbyist_business_name') || null;

  const rawSubjects = arrField('subjectMatters', 'subject_matters', 'Subject_Matters', 'Subject_Matter');
  const subjectMatters = Array.isArray(rawSubjects)
    ? rawSubjects
    : typeof rawSubjects === 'string'
      ? [rawSubjects]
      : [];

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

  const communicationDate = strField('communicationDate', 'communication_date', 'Communication_Date',
    'registrationStartDate', 'registration_start_date', 'Registration_Date');

  const startDate = strField('registrationStartDate', 'registration_start_date', 'Registration_Start_Date') || null;
  const endDate = strField('registrationEndDate', 'registration_end_date', 'Registration_End_Date') || null;

  const category = strField('lobbyistCategory', 'lobbyist_category', 'Lobbyist_Category');
  const lobbyistType = determineLobbyistType(category);

  const sourceUrl = strField('sourceUrl', 'source_url', 'Source_URL');
  const originalId = strField('registrationNumber', 'registration_number', 'Registration_Number') || null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const sourceSystem = options.sourceSystem ?? 'bc-registry';

  const contentForHash = JSON.stringify({
    registrantName,
    clientName,
    clientBusiness,
    governmentInstitution,
    publicOfficeHolder,
    communicationDate,
    startDate,
    endDate,
    normalizedSubjects: subjectMatters,
    lobbyistType,
    province: 'BC',
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    province: 'BC',
    registrantName,
    registrantClient,
    registrantAddress,
    clientName,
    clientBusiness,
    subjectMatter: subjectMatters as string[],
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
 * Normalize a raw Alberta lobbying record to the unified schema.
 */
export async function normalizeAlbertaRecord(
  raw: RawAlbertaRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  const strField = (...keys: (keyof RawAlbertaRecord | string)[]): string => {
    for (const key of keys) {
      const v = raw[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };

  const arrField = (...keys: (keyof RawAlbertaRecord | string)[]): unknown[] => {
    for (const key of keys) {
      const v = raw[key];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const registrantName = strField('lobbyistName', 'lobbyistBusinessName', 'registrantName', 'lobbyist_name');
  const clientName = strField('clientName', 'client_name', 'Organization_Name', 'organization_name');

  if (!registrantName && !clientName) {
    return null;
  }

  const clientBusiness = strField('clientBusiness', 'client_business', 'Client_Business') || null;
  const registrantAddress = strField('lobbyistAddress', 'lobbyist_address', 'Registrant_Address') || null;
  const registrantClient = strField('lobbyistBusinessName', 'lobbyist_business_name') || null;

  const rawSubjects = arrField('subjectMatters', 'subject_matters', 'Subject_Matters', 'Subject_Matter');
  const subjectMatters = Array.isArray(rawSubjects)
    ? rawSubjects
    : typeof rawSubjects === 'string'
      ? [rawSubjects]
      : [];

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

  const communicationDate = strField('communicationDate', 'communication_date', 'Communication_Date',
    'registrationStartDate', 'registration_start_date', 'Registration_Date');

  const startDate = strField('registrationStartDate', 'registration_start_date', 'Registration_Start_Date') || null;
  const endDate = strField('registrationEndDate', 'registration_end_date', 'Registration_End_Date') || null;

  const category = strField('lobbyistCategory', 'lobbyist_category', 'Lobbyist_Category');
  const lobbyistType = determineLobbyistType(category);

  const sourceUrl = strField('sourceUrl', 'source_url', 'Source_URL');
  const originalId = strField('registrationNumber', 'registration_number', 'Registration_Number') || null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const sourceSystem = options.sourceSystem ?? 'alberta-registry';

  const contentForHash = JSON.stringify({
    registrantName,
    clientName,
    clientBusiness,
    governmentInstitution,
    publicOfficeHolder,
    communicationDate,
    startDate,
    endDate,
    normalizedSubjects: subjectMatters,
    lobbyistType,
    province: 'AB',
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    province: 'AB',
    registrantName,
    registrantClient,
    registrantAddress,
    clientName,
    clientBusiness,
    subjectMatter: subjectMatters as string[],
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
 * Normalize a raw Quebec lobbying record to the unified schema.
 */
export async function normalizeQuebecRecord(
  raw: RawQuebecRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  const strField = (...keys: (keyof RawQuebecRecord | string)[]): string => {
    for (const key of keys) {
      const v = raw[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };

  const arrField = (...keys: (keyof RawQuebecRecord | string)[]): unknown[] => {
    for (const key of keys) {
      const v = raw[key];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const registrantName = strField('lobbyistName', 'lobbyistBusinessName', 'registrantName', 'lobbyist_name');
  const clientName = strField('clientName', 'client_name', 'Organization_Name', 'organization_name');

  if (!registrantName && !clientName) {
    return null;
  }

  const clientBusiness = strField('clientBusiness', 'client_business', 'Client_Business') || null;
  const registrantAddress = strField('lobbyistAddress', 'lobbyist_address', 'Registrant_Address') || null;
  const registrantClient = strField('lobbyistBusinessName', 'lobbyist_business_name') || null;

  const rawSubjects = arrField('subjectMatters', 'subject_matters', 'Subject_Matters', 'Subject_Matter');
  const subjectMatters = Array.isArray(rawSubjects)
    ? rawSubjects
    : typeof rawSubjects === 'string'
      ? [rawSubjects]
      : [];

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

  const communicationDate = strField('communicationDate', 'communication_date', 'Communication_Date',
    'registrationStartDate', 'registration_start_date', 'Registration_Date');

  const startDate = strField('registrationStartDate', 'registration_start_date', 'Registration_Start_Date') || null;
  const endDate = strField('registrationEndDate', 'registration_end_date', 'Registration_End_Date') || null;

  const category = strField('lobbyistCategory', 'lobbyist_category', 'Lobbyist_Category');
  const lobbyistType = determineLobbyistType(category);

  const sourceUrl = strField('sourceUrl', 'source_url', 'Source_URL');
  const originalId = strField('registrationNumber', 'registration_number', 'Registration_Number') || null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const sourceSystem = options.sourceSystem ?? 'quebec-registry';

  const contentForHash = JSON.stringify({
    registrantName,
    clientName,
    clientBusiness,
    governmentInstitution,
    publicOfficeHolder,
    communicationDate,
    startDate,
    endDate,
    normalizedSubjects: subjectMatters,
    lobbyistType,
    province: 'QC',
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    province: 'QC',
    registrantName,
    registrantClient,
    registrantAddress,
    clientName,
    clientBusiness,
    subjectMatter: subjectMatters as string[],
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
 * Normalize a raw Saskatchewan lobbying record to the unified schema.
 */
export async function normalizeSaskatchewanRecord(
  raw: RawSaskatchewanRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  const strField = (...keys: (keyof RawSaskatchewanRecord | string)[]): string => {
    for (const key of keys) {
      const v = raw[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };

  const arrField = (...keys: (keyof RawSaskatchewanRecord | string)[]): unknown[] => {
    for (const key of keys) {
      const v = raw[key];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const registrantName = strField('lobbyistName', 'lobbyistBusinessName', 'registrantName', 'lobbyist_name');
  const clientName = strField('clientName', 'client_name', 'Organization_Name', 'organization_name');

  if (!registrantName && !clientName) {
    return null;
  }

  const clientBusiness = strField('clientBusiness', 'client_business', 'Client_Business') || null;
  const registrantAddress = strField('lobbyistAddress', 'lobbyist_address', 'Registrant_Address') || null;
  const registrantClient = strField('lobbyistBusinessName', 'lobbyist_business_name') || null;

  const rawSubjects = arrField('subjectMatters', 'subject_matters', 'Subject_Matters', 'Subject_Matter');
  const subjectMatters = Array.isArray(rawSubjects)
    ? rawSubjects
    : typeof rawSubjects === 'string'
      ? [rawSubjects]
      : [];

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

  const communicationDate = strField('communicationDate', 'communication_date', 'Communication_Date',
    'registrationStartDate', 'registration_start_date', 'Registration_Date');

  const startDate = strField('registrationStartDate', 'registration_start_date', 'Registration_Start_Date') || null;
  const endDate = strField('registrationEndDate', 'registration_end_date', 'Registration_End_Date') || null;

  const category = strField('lobbyistCategory', 'lobbyist_category', 'Lobbyist_Category');
  const lobbyistType = determineLobbyistType(category);

  const sourceUrl = strField('sourceUrl', 'source_url', 'Source_URL');
  const originalId = strField('registrationNumber', 'registration_number', 'Registration_Number') || null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const sourceSystem = options.sourceSystem ?? 'saskatchewan-registry';

  const contentForHash = JSON.stringify({
    registrantName,
    clientName,
    clientBusiness,
    governmentInstitution,
    publicOfficeHolder,
    communicationDate,
    startDate,
    endDate,
    normalizedSubjects: subjectMatters,
    lobbyistType,
    province: 'SK',
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    province: 'SK',
    registrantName,
    registrantClient,
    registrantAddress,
    clientName,
    clientBusiness,
    subjectMatter: subjectMatters as string[],
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
 * Normalize a raw Manitoba lobbying record to the unified schema.
 */
export async function normalizeManitobaRecord(
  raw: RawManitobaRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  const strField = (...keys: (keyof RawManitobaRecord | string)[]): string => {
    for (const key of keys) {
      const v = raw[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };

  const arrField = (...keys: (keyof RawManitobaRecord | string)[]): unknown[] => {
    for (const key of keys) {
      const v = raw[key];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const registrantName = strField('lobbyistName', 'lobbyistBusinessName', 'registrantName', 'lobbyist_name');
  const clientName = strField('clientName', 'client_name', 'Organization_Name', 'organization_name');

  if (!registrantName && !clientName) {
    return null;
  }

  const clientBusiness = strField('clientBusiness', 'client_business', 'Client_Business') || null;
  const registrantAddress = strField('lobbyistAddress', 'lobbyist_address', 'Registrant_Address') || null;
  const registrantClient = strField('lobbyistBusinessName', 'lobbyist_business_name') || null;

  const rawSubjects = arrField('subjectMatters', 'subject_matters', 'Subject_Matters', 'Subject_Matter');
  const subjectMatters = Array.isArray(rawSubjects)
    ? rawSubjects
    : typeof rawSubjects === 'string'
      ? [rawSubjects]
      : [];

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

  const communicationDate = strField('communicationDate', 'communication_date', 'Communication_Date',
    'registrationStartDate', 'registration_start_date', 'Registration_Date');

  const startDate = strField('registrationStartDate', 'registration_start_date', 'Registration_Start_Date') || null;
  const endDate = strField('registrationEndDate', 'registration_end_date', 'Registration_End_Date') || null;

  const category = strField('lobbyistCategory', 'lobbyist_category', 'Lobbyist_Category');
  const lobbyistType = determineLobbyistType(category);

  const sourceUrl = strField('sourceUrl', 'source_url', 'Source_URL');
  const originalId = strField('registrationNumber', 'registration_number', 'Registration_Number') || null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const sourceSystem = options.sourceSystem ?? 'manitoba-registry';

  const contentForHash = JSON.stringify({
    registrantName,
    clientName,
    clientBusiness,
    governmentInstitution,
    publicOfficeHolder,
    communicationDate,
    startDate,
    endDate,
    normalizedSubjects: subjectMatters,
    lobbyistType,
    province: 'MB',
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    province: 'MB',
    registrantName,
    registrantClient,
    registrantAddress,
    clientName,
    clientBusiness,
    subjectMatter: subjectMatters as string[],
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
 * Normalize a raw Nova Scotia lobbying record to the unified schema.
 */
export async function normalizeNovaScotiaRecord(
  raw: RawNovaScotiaRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  const strField = (...keys: (keyof RawNovaScotiaRecord | string)[]): string => {
    for (const key of keys) {
      const v = raw[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };

  const arrField = (...keys: (keyof RawNovaScotiaRecord | string)[]): unknown[] => {
    for (const key of keys) {
      const v = raw[key];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const registrantName = strField('lobbyistName', 'lobbyistBusinessName', 'registrantName', 'lobbyist_name');
  const clientName = strField('clientName', 'client_name', 'Organization_Name', 'organization_name');

  if (!registrantName && !clientName) {
    return null;
  }

  const clientBusiness = strField('clientBusiness', 'client_business', 'Client_Business') || null;
  const registrantAddress = strField('lobbyistAddress', 'lobbyist_address', 'Registrant_Address') || null;
  const registrantClient = strField('lobbyistBusinessName', 'lobbyist_business_name') || null;

  const rawSubjects = arrField('subjectMatters', 'subject_matters', 'Subject_Matters', 'Subject_Matter');
  const subjectMatters = Array.isArray(rawSubjects)
    ? rawSubjects
    : typeof rawSubjects === 'string'
      ? [rawSubjects]
      : [];

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

  const communicationDate = strField('communicationDate', 'communication_date', 'Communication_Date',
    'registrationStartDate', 'registration_start_date', 'Registration_Date');

  const startDate = strField('registrationStartDate', 'registration_start_date', 'Registration_Start_Date') || null;
  const endDate = strField('registrationEndDate', 'registration_end_date', 'Registration_End_Date') || null;

  const category = strField('lobbyistCategory', 'lobbyist_category', 'Lobbyist_Category');
  const lobbyistType = determineLobbyistType(category);

  const sourceUrl = strField('sourceUrl', 'source_url', 'Source_URL');
  const originalId = strField('registrationNumber', 'registration_number', 'Registration_Number') || null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const sourceSystem = options.sourceSystem ?? 'nova-scotia-registry';

  const contentForHash = JSON.stringify({
    registrantName,
    clientName,
    clientBusiness,
    governmentInstitution,
    publicOfficeHolder,
    communicationDate,
    startDate,
    endDate,
    normalizedSubjects: subjectMatters,
    lobbyistType,
    province: 'NS',
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    province: 'NS',
    registrantName,
    registrantClient,
    registrantAddress,
    clientName,
    clientBusiness,
    subjectMatter: subjectMatters as string[],
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
 * Normalize a raw New Brunswick lobbying record to the unified schema.
 */
export async function normalizeNewBrunswickRecord(
  raw: RawNewBrunswickRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  const strField = (...keys: (keyof RawNewBrunswickRecord | string)[]): string => {
    for (const key of keys) {
      const v = raw[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };

  const arrField = (...keys: (keyof RawNewBrunswickRecord | string)[]): unknown[] => {
    for (const key of keys) {
      const v = raw[key];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const registrantName = strField('lobbyistName', 'lobbyistBusinessName', 'registrantName', 'lobbyist_name');
  const clientName = strField('clientName', 'client_name', 'Organization_Name', 'organization_name');

  if (!registrantName && !clientName) {
    return null;
  }

  const clientBusiness = strField('clientBusiness', 'client_business', 'Client_Business') || null;
  const registrantAddress = strField('lobbyistAddress', 'lobbyist_address', 'Registrant_Address') || null;
  const registrantClient = strField('lobbyistBusinessName', 'lobbyist_business_name') || null;

  const rawSubjects = arrField('subjectMatters', 'subject_matters', 'Subject_Matters', 'Subject_Matter');
  const subjectMatters = Array.isArray(rawSubjects)
    ? rawSubjects
    : typeof rawSubjects === 'string'
      ? [rawSubjects]
      : [];

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

  const communicationDate = strField('communicationDate', 'communication_date', 'Communication_Date',
    'registrationStartDate', 'registration_start_date', 'Registration_Date');

  const startDate = strField('registrationStartDate', 'registration_start_date', 'Registration_Start_Date') || null;
  const endDate = strField('registrationEndDate', 'registration_end_date', 'Registration_End_Date') || null;

  const category = strField('lobbyistCategory', 'lobbyist_category', 'Lobbyist_Category');
  const lobbyistType = determineLobbyistType(category);

  const sourceUrl = strField('sourceUrl', 'source_url', 'Source_URL');
  const originalId = strField('registrationNumber', 'registration_number', 'Registration_Number') || null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const sourceSystem = options.sourceSystem ?? 'new-brunswick-registry';

  const contentForHash = JSON.stringify({
    registrantName,
    clientName,
    clientBusiness,
    governmentInstitution,
    publicOfficeHolder,
    communicationDate,
    startDate,
    endDate,
    normalizedSubjects: subjectMatters,
    lobbyistType,
    province: 'NB',
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    province: 'NB',
    registrantName,
    registrantClient,
    registrantAddress,
    clientName,
    clientBusiness,
    subjectMatter: subjectMatters as string[],
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
 * Normalize a raw Newfoundland and Labrador lobbying record to the unified schema.
 */
export async function normalizeNewfoundlandRecord(
  raw: RawNewfoundlandRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  const strField = (...keys: (keyof RawNewfoundlandRecord | string)[]): string => {
    for (const key of keys) {
      const v = raw[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };

  const arrField = (...keys: (keyof RawNewfoundlandRecord | string)[]): unknown[] => {
    for (const key of keys) {
      const v = raw[key];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const registrantName = strField('lobbyistName', 'lobbyistBusinessName', 'registrantName', 'lobbyist_name');
  const clientName = strField('clientName', 'client_name', 'Organization_Name', 'organization_name');

  if (!registrantName && !clientName) {
    return null;
  }

  const clientBusiness = strField('clientBusiness', 'client_business', 'Client_Business') || null;
  const registrantAddress = strField('lobbyistAddress', 'lobbyist_address', 'Registrant_Address') || null;
  const registrantClient = strField('lobbyistBusinessName', 'lobbyist_business_name') || null;

  const rawSubjects = arrField('subjectMatters', 'subject_matters', 'Subject_Matters', 'Subject_Matter');
  const subjectMatters = Array.isArray(rawSubjects)
    ? rawSubjects
    : typeof rawSubjects === 'string'
      ? [rawSubjects]
      : [];

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

  const communicationDate = strField('communicationDate', 'communication_date', 'Communication_Date',
    'registrationStartDate', 'registration_start_date', 'Registration_Date');

  const startDate = strField('registrationStartDate', 'registration_start_date', 'Registration_Start_Date') || null;
  const endDate = strField('registrationEndDate', 'registration_end_date', 'Registration_End_Date') || null;

  const category = strField('lobbyistCategory', 'lobbyist_category', 'Lobbyist_Category');
  const lobbyistType = determineLobbyistType(category);

  const sourceUrl = strField('sourceUrl', 'source_url', 'Source_URL');
  const originalId = strField('registrationNumber', 'registration_number', 'Registration_Number') || null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const sourceSystem = options.sourceSystem ?? 'newfoundland-registry';

  const contentForHash = JSON.stringify({
    registrantName,
    clientName,
    clientBusiness,
    governmentInstitution,
    publicOfficeHolder,
    communicationDate,
    startDate,
    endDate,
    normalizedSubjects: subjectMatters,
    lobbyistType,
    province: 'NL',
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    province: 'NL',
    registrantName,
    registrantClient,
    registrantAddress,
    clientName,
    clientBusiness,
    subjectMatter: subjectMatters as string[],
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
 * Normalize a raw Prince Edward Island lobbying record to the unified schema.
 */
export async function normalizePEIRecord(
  raw: RawPEIRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  const strField = (...keys: (keyof RawPEIRecord | string)[]): string => {
    for (const key of keys) {
      const v = raw[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };

  const arrField = (...keys: (keyof RawPEIRecord | string)[]): unknown[] => {
    for (const key of keys) {
      const v = raw[key];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const registrantName = strField('lobbyistName', 'lobbyistBusinessName', 'registrantName', 'lobbyist_name');
  const clientName = strField('clientName', 'client_name', 'Organization_Name', 'organization_name');

  if (!registrantName && !clientName) {
    return null;
  }

  const clientBusiness = strField('clientBusiness', 'client_business', 'Client_Business') || null;
  const registrantAddress = strField('lobbyistAddress', 'lobbyist_address', 'Registrant_Address') || null;
  const registrantClient = strField('lobbyistBusinessName', 'lobbyist_business_name') || null;

  const rawSubjects = arrField('subjectMatters', 'subject_matters', 'Subject_Matters', 'Subject_Matter');
  const subjectMatters = Array.isArray(rawSubjects)
    ? rawSubjects
    : typeof rawSubjects === 'string'
      ? [rawSubjects]
      : [];

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

  const communicationDate = strField('communicationDate', 'communication_date', 'Communication_Date',
    'registrationStartDate', 'registration_start_date', 'Registration_Date');

  const startDate = strField('registrationStartDate', 'registration_start_date', 'Registration_Start_Date') || null;
  const endDate = strField('registrationEndDate', 'registration_end_date', 'Registration_End_Date') || null;

  const category = strField('lobbyistCategory', 'lobbyist_category', 'Lobbyist_Category');
  const lobbyistType = determineLobbyistType(category);

  const sourceUrl = strField('sourceUrl', 'source_url', 'Source_URL');
  const originalId = strField('registrationNumber', 'registration_number', 'Registration_Number') || null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const sourceSystem = options.sourceSystem ?? 'pei-registry';

  const contentForHash = JSON.stringify({
    registrantName,
    clientName,
    clientBusiness,
    governmentInstitution,
    publicOfficeHolder,
    communicationDate,
    startDate,
    endDate,
    normalizedSubjects: subjectMatters,
    lobbyistType,
    province: 'PE',
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    province: 'PE',
    registrantName,
    registrantClient,
    registrantAddress,
    clientName,
    clientBusiness,
    subjectMatter: subjectMatters as string[],
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
 * Normalize a raw Yukon lobbying record to the unified schema.
 */
export async function normalizeYukonRecord(
  raw: RawYukonRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  const strField = (...keys: (keyof RawYukonRecord | string)[]): string => {
    for (const key of keys) {
      const v = raw[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };

  const arrField = (...keys: (keyof RawYukonRecord | string)[]): unknown[] => {
    for (const key of keys) {
      const v = raw[key];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const registrantName = strField('lobbyistName', 'lobbyistBusinessName', 'registrantName', 'lobbyist_name');
  const clientName = strField('clientName', 'client_name', 'Organization_Name', 'organization_name');

  if (!registrantName && !clientName) {
    return null;
  }

  const clientBusiness = strField('clientBusiness', 'client_business', 'Client_Business') || null;
  const registrantAddress = strField('lobbyistAddress', 'lobbyist_address', 'Registrant_Address') || null;
  const registrantClient = strField('lobbyistBusinessName', 'lobbyist_business_name') || null;

  const rawSubjects = arrField('subjectMatters', 'subject_matters', 'Subject_Matters', 'Subject_Matter');
  const subjectMatters = Array.isArray(rawSubjects)
    ? rawSubjects
    : typeof rawSubjects === 'string'
      ? [rawSubjects]
      : [];

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

  const communicationDate = strField('communicationDate', 'communication_date', 'Communication_Date',
    'registrationStartDate', 'registration_start_date', 'Registration_Date');

  const startDate = strField('registrationStartDate', 'registration_start_date', 'Registration_Start_Date') || null;
  const endDate = strField('registrationEndDate', 'registration_end_date', 'Registration_End_Date') || null;

  const category = strField('lobbyistCategory', 'lobbyist_category', 'Lobbyist_Category');
  const lobbyistType = determineLobbyistType(category);

  const sourceUrl = strField('sourceUrl', 'source_url', 'Source_URL');
  const originalId = strField('registrationNumber', 'registration_number', 'Registration_Number') || null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const sourceSystem = options.sourceSystem ?? 'yukon-registry';

  const contentForHash = JSON.stringify({
    registrantName,
    clientName,
    clientBusiness,
    governmentInstitution,
    publicOfficeHolder,
    communicationDate,
    startDate,
    endDate,
    normalizedSubjects: subjectMatters,
    lobbyistType,
    province: 'YT',
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    province: 'YT',
    registrantName,
    registrantClient,
    registrantAddress,
    clientName,
    clientBusiness,
    subjectMatter: subjectMatters as string[],
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
 * Normalize a raw NWT lobbying record to the unified schema.
 * NWT meeting records from the public registry.
 */
export async function normalizeNWTRecord(
  raw: RawNWTRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  const strField = (...keys: (keyof RawNWTRecord | string)[]): string => {
    for (const key of keys) {
      const v = raw[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };

  const arrField = (...keys: (keyof RawNWTRecord | string)[]): unknown[] => {
    for (const key of keys) {
      const v = raw[key];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const registrantName = strField('lobbyistName');
  const clientName = strField('clientName');
  const communicationDate = strField('communicationDate');

  // NWT meeting records must have at least a meeting date and either a minister or outside party
  if (!communicationDate || (!registrantName && !clientName)) {
    return null;
  }

  const governmentBodies = arrField('governmentBodies');
  const officials = arrField('officials');
  const rawSubjects = arrField('subjectMatters');

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

  const subjectMatters = Array.isArray(rawSubjects)
    ? rawSubjects
    : typeof rawSubjects === 'string'
      ? [rawSubjects]
      : [];

  const sourceUrl = strField('sourceUrl');
  const originalId = strField('registrationNumber') || null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const sourceSystem = options.sourceSystem ?? 'nwt-meeting-registry';

  const contentForHash = JSON.stringify({
    registrantName,
    clientName,
    governmentInstitution,
    publicOfficeHolder,
    communicationDate,
    normalizedSubjects: subjectMatters,
    province: 'NT',
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    province: 'NT',
    registrantName,
    registrantClient: null,
    registrantAddress: null,
    clientName,
    clientBusiness: null,
    subjectMatter: subjectMatters as string[],
    governmentInstitution,
    publicOfficeHolder,
    communicationDate,
    startDate: null,
    endDate: null,
    lobbyingCostCad: null,
    lobbyistType: 'consultant',
    sourceUrl,
    ingestedAt: now,
    originalId,
    sourceSystem,
  };
}


/**
 * Normalize a raw Nunavut lobbying record to the unified schema.
 * Nunavut records from the federal proxy registry.
 */
export async function normalizeNunavutRecord(
  raw: RawNunavutRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  const strField = (...keys: (keyof RawNunavutRecord | string)[]): string => {
    for (const key of keys) {
      const v = raw[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };

  const arrField = (...keys: (keyof RawNunavutRecord | string)[]): unknown[] => {
    for (const key of keys) {
      const v = raw[key];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const registrantName = strField('lobbyistName');
  const clientName = strField('clientName');

  if (!registrantName && !clientName) {
    return null;
  }

  const clientBusiness = strField('clientBusiness') || null;
  const registrantAddress = strField('lobbyistAddress') || null;
  const registrantClient = strField('lobbyistBusinessName') || null;

  const rawSubjects = arrField('subjectMatters');
  const subjectMatters = Array.isArray(rawSubjects)
    ? rawSubjects
    : typeof rawSubjects === 'string'
      ? [rawSubjects]
      : [];

  const governmentBodies = arrField('governmentBodies');
  const officials = arrField('officials');

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

  const communicationDate = strField('communicationDate', 'registrationStartDate');
  const startDate = strField('registrationStartDate') || null;
  const endDate = strField('registrationEndDate') || null;

  const category = strField('lobbyistCategory');
  const lobbyistType = determineLobbyistType(category);

  const sourceUrl = strField('sourceUrl');
  const originalId = strField('registrationNumber') || null;

  const now = options.ingestedAt ?? new Date().toISOString();
  const sourceSystem = options.sourceSystem ?? 'nunavut-federal-proxy';

  const contentForHash = JSON.stringify({
    registrantName,
    clientName,
    clientBusiness,
    governmentInstitution,
    publicOfficeHolder,
    communicationDate,
    startDate,
    endDate,
    normalizedSubjects: subjectMatters,
    lobbyistType,
    province: 'NU',
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    province: 'NU',
    registrantName,
    registrantClient,
    registrantAddress,
    clientName,
    clientBusiness,
    subjectMatter: subjectMatters as string[],
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
  raw: RawOntarioRecord | RawBCRecord | RawAlbertaRecord | RawQuebecRecord | RawSaskatchewanRecord | RawManitobaRecord | RawNovaScotiaRecord | RawNewBrunswickRecord | RawNewfoundlandRecord | RawPEIRecord | RawYukonRecord | RawNWTRecord | RawNunavutRecord | Record<string, unknown>,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ProvincialLobbyingRecord | null> {
  switch (province) {
    case 'ON':
      return normalizeOntarioRecord(raw as RawOntarioRecord, options);
    case 'BC':
      return normalizeBCRecord(raw as RawBCRecord, options);
    case 'AB':
      return normalizeAlbertaRecord(raw as RawAlbertaRecord, options);
    case 'QC':
      return normalizeQuebecRecord(raw as RawQuebecRecord, options);
    case 'SK':
      return normalizeSaskatchewanRecord(raw as RawSaskatchewanRecord, options);
    case 'MB':
      return normalizeManitobaRecord(raw as RawManitobaRecord, options);
    case 'NS':
      return normalizeNovaScotiaRecord(raw as RawNovaScotiaRecord, options);
    case 'NB':
      return normalizeNewBrunswickRecord(raw as RawNewBrunswickRecord, options);
    case 'NL':
      return normalizeNewfoundlandRecord(raw as RawNewfoundlandRecord, options);
    case 'PE':
      return normalizePEIRecord(raw as RawPEIRecord, options);
    case 'YT':
      return normalizeYukonRecord(raw as RawYukonRecord, options);
    case 'NT':
      return normalizeNWTRecord(raw as RawNWTRecord, options);
    case 'NU':
      return normalizeNunavutRecord(raw as RawNunavutRecord, options);
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
  rawRecords: RawOntarioRecord[] | RawBCRecord[] | RawAlbertaRecord[] | RawQuebecRecord[] | RawSaskatchewanRecord[] | RawManitobaRecord[] | RawNovaScotiaRecord[] | RawNewBrunswickRecord[] | RawNewfoundlandRecord[] | RawPEIRecord[] | RawYukonRecord[] | RawNWTRecord[] | RawNunavutRecord[],
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
