// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ATI (Access to Information) Parser — Quill
 *
 * Normalizes raw ATI records from CKAN packages, CSV resources,
 * and department HTML pages into the unified AtiRecord schema.
 *
 * Each record represents a single completed Access to Information
 * request, with fields for disposition, page counts, and metadata.
 */

import { computeHash } from '../../verification/hashing.js';
import {
  ATI_DISPOSITION_MAP,
  ATI_CKAN_ORG_MAP,
  ATI_DEPARTMENT_ACRONYM_MAP,
} from './constants.js';
import type {
  AtiRecord,
  AtiDisposition,
  RawAtiRecord,
  RawAtiCkanPackage,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Disposition Normalization                                          */
/* ------------------------------------------------------------------ */

/**
 * Normalize a raw disposition value to the unified AtiDisposition type.
 *
 * @param raw - Raw disposition string from source
 * @returns Normalized disposition value
 */
export function normalizeDisposition(raw: string | null | undefined): AtiDisposition {
  if (!raw) return 'unknown';

  const trimmed = raw.trim().toLowerCase();

  // Direct map match
  const mapped = ATI_DISPOSITION_MAP[trimmed];
  if (mapped) return mapped;

  // Partial matching for common variants
  if (trimmed.includes('all disclosed') || (trimmed.includes('disclosed') && !trimmed.includes('part'))) {
    return 'disclosed';
  }
  if (trimmed.includes('disclosed in part') || trimmed.includes('partially disclosed') || trimmed.includes('exempted in part')) {
    return 'disclosed-part';
  }
  if (trimmed.includes('exempted') || trimmed.includes('exempt') || trimmed.includes('exception')) {
    return 'exempted';
  }
  if (trimmed.includes('excluded') || trimmed.includes('exclusion')) {
    return 'excluded';
  }
  if (trimmed.includes('no record') || trimmed.includes('none') || trimmed === 'n/a') {
    return 'no-records';
  }
  if (trimmed.includes('transferred')) {
    return 'transferred';
  }
  if (trimmed.includes('abandoned')) {
    return 'abandoned';
  }
  if (trimmed.includes('pending') || trimmed.includes('in process') || trimmed.includes('in progress')) {
    return 'pending';
  }

  return 'unknown';
}

/* ------------------------------------------------------------------ */
/*  Raw ATI Record → AtiRecord                                         */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw ATI record into a normalized AtiRecord.
 *
 * @param raw - Raw ATI record from any source
 * @param options - Parsing options
 * @returns Normalized AtiRecord or null if invalid
 */
export async function parseAtiRecord(
  raw: RawAtiRecord,
  options: {
    /** Override the source system name */
    sourceSystem?: string;
    /** Override the ingested at timestamp */
    ingestedAt?: string;
  } = {},
): Promise<AtiRecord | null> {
  // Extract department info
  const deptName = raw.department ?? '';
  const deptAcronym = raw.departmentAcronym ?? null;

  // Request number is required
  const requestNumber = raw.requestNumber ?? '';
  if (!requestNumber) {
    return null;
  }

  // Summary
  const summary = raw.summary ?? null;

  // Disposition
  const disposition = normalizeDisposition(
    typeof raw.disposition === 'string' ? raw.disposition : undefined,
  );

  // Page counts
  const pagesReleased = parseNumberField(raw.pagesReleased);
  const pagesWithheld = parseNumberField(raw.pagesWithheld);

  // Dates
  const dateCompleted = raw.dateCompleted ?? null;
  const fiscalYear = raw.fiscalYear ?? extractFiscalYear(dateCompleted);

  // Source URL
  const sourceUrl = raw.sourceUrl ?? '';

  // CKAN references
  const ckanPackageId = raw.ckanPackageId ?? null;
  const ckanResourceId = raw.ckanResourceId ?? null;

  // Source system
  const sourceSystem = options.sourceSystem ?? raw.sourceSystem ?? 'unknown';

  // Skip invalid records
  if (!deptName && !requestNumber) {
    return null;
  }

  const now = options.ingestedAt ?? new Date().toISOString();

  // Build content hash from normalized fields
  const contentForHash = JSON.stringify({
    requestNumber,
    department: deptName,
    summary,
    disposition,
    pagesReleased,
    pagesWithheld,
    dateCompleted,
    fiscalYear,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    department: deptName || 'Unknown',
    departmentAcronym: deptAcronym,
    requestNumber,
    summary,
    disposition,
    pagesReleased,
    pagesWithheld,
    dateCompleted,
    fiscalYear,
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
 * Parse a batch of raw ATI records.
 *
 * @param rawRecords - Array of raw records from any source
 * @param options - Parsing options
 * @returns Array of parsed AtiRecords (invalid records filtered out)
 */
export async function parseAtiBatch(
  rawRecords: RawAtiRecord[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<AtiRecord[]> {
  const results: AtiRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseAtiRecord(raw, options);
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
 * Parse a CKAN package into an array of ATI records.
 * A CKAN package may represent a single ATI request or a collection.
 *
 * For packages that are just single ATI request entries, this returns
 * a single record. For packages that contain a CSV dump of multiple
 * records, this returns a package-level summary record.
 *
 * @param pkg - Raw CKAN package
 * @param options - Parsing options
 * @returns Array of parsed AtiRecords
 */
export async function parseAtiCkanPackage(
  pkg: RawAtiCkanPackage,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<AtiRecord[]> {
  const results: AtiRecord[] = [];

  // Determine department from organization
  let department = '';
  let deptAcronym: string | null = null;

  if (pkg.organization) {
    const orgInfo = ATI_CKAN_ORG_MAP[pkg.organization.name];
    if (orgInfo) {
      department = orgInfo.name;
      deptAcronym = orgInfo.acronym;
    } else {
      department = pkg.organization.title || pkg.organization.name;
    }
  }

  // If the package seems to be about a specific ATI request
  const rawRecord: RawAtiRecord = {
    department,
    departmentAcronym: deptAcronym || undefined,
    requestNumber: extractRequestNumber(pkg.title) ?? pkg.id.substring(0, 8),
    summary: pkg.notes ?? pkg.title,
    dateCompleted: pkg.metadata_created,
    fiscalYear: extractFiscalYear(pkg.title) || extractFiscalYear(pkg.notes ?? '') || undefined,
    sourceUrl: `${pkg.name ? 'https://open.canada.ca/data/dataset/' + pkg.name : ''}`,
    ckanPackageId: pkg.id,
    sourceSystem: options.sourceSystem ?? 'open-canada-ckan',
  };

  // Try to extract disposition from tags
  if (pkg.tags) {
    for (const tag of pkg.tags) {
      const disp = normalizeDisposition(tag.name);
      if (disp !== 'unknown') {
        rawRecord.disposition = disp;
        break;
      }
    }
  }

  // Fall back to disposition from title
  if (!rawRecord.disposition) {
    rawRecord.disposition = extractDispositionFromTitle(pkg.title);
  }

  const parsed = await parseAtiRecord(rawRecord, options);
  if (parsed) {
    results.push(parsed);
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Utility Functions                                                  */
/* ------------------------------------------------------------------ */

/**
 * Parse a numeric field that may be a string or number.
 */
function parseNumberField(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed.replace(/[^0-9\-]/g, ''), 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Extract a 4-digit year or fiscal year from text.
 */
function extractFiscalYear(text: string | null): string | null {
  if (!text) return null;

  // Match fiscal years like "2023-24" or "20232024"
  const fiscalPattern = /(20\d{2})[-–](20)?(\d{2})/;
  const fiscalMatch = text.match(fiscalPattern);
  if (fiscalMatch) {
    const start = fiscalMatch[1];
    const end = fiscalMatch[3];
    return `${start}-${end}`;
  }

  // Match 4-digit years
  const yearPattern = /\b(20\d{2})\b/;
  const yearMatch = text.match(yearPattern);
  if (yearMatch) {
    return yearMatch[1];
  }

  return null;
}

/**
 * Extract a request number from a CKAN package title.
 * ATI CKAN titles often include request numbers like "A-2023-001".
 */
function extractRequestNumber(title: string): string | null {
  if (!title) return null;

  // Match request number patterns like A-2023-001, 2023-001, REQ-2023-001
  const patterns = [
    /[A-Z]+-\d{4}-\d{3,}/,    // A-2023-001
    /\d{4}-\d{3,}/,            // 2023-001
    /REQ[-_]\d{4}[-_]\d{3,}/i, // REQ-2023-001
    /ATI[-_]\d{4}[-_]\d{3,}/i, // ATI-2023-001
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

/**
 * Extract a disposition hint from a CKAN package title.
 */
function extractDispositionFromTitle(title: string): string | undefined {
  return normalizeDisposition(title) ?? undefined;
}
