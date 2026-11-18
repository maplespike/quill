// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Financial Regulation Parser — Quill
 *
 * Parses CKAN data from Canadian financial regulators (OSFI, CDIC, FCAC)
 * into unified BankData, InsuranceData, CDICMember, and Complaint schemas.
 *
 * Parsers:
 *   - parseOSFIRecord(record) — Parse OSFI bank/insurance regulatory data
 *   - parseCDICRecord(record) — Parse CDIC deposit insurance membership data
 *   - parseFCACRecord(record) — Parse FCAC consumer complaint data
 *   - parseFinancialRegulationRecords(records, options) — Batch parser with dedup
 */

import { computeHash } from '../../verification/hashing.js';
import { OSFI_BASE, CDIC_BASE, FCAC_BASE } from './constants.js';
import type {
  BankData,
  InsuranceData,
  CDICMember,
  Complaint,
  FinRegRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Safely get a field value from a record with multiple possible key names.
 */
function getField<T>(
  record: Record<string, unknown>,
  keys: string[],
): T | null {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key] as T;
    }
  }
  return null;
}

/**
 * Parse a numeric value from various formats (string with commas, currency, etc.).
 */
function parseNumeric(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value
      .replace(/[$,]/g, '')
      .replace(/\s+/g, '')
      .trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

/**
 * Normalize institution/company name by trimming and capitalizing properly.
 */
function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Detect institution category (bank vs insurance) from various fields.
 */
function detectInstitutionCategory(record: Record<string, unknown>): string {
  const categoryKeys = ['category', 'institutionType', 'institution_type', 'sector', 'type'];
  const category = getField<string>(record, categoryKeys);
  if (category) {
    const lower = category.toLowerCase();
    if (lower.includes('bank') || lower.includes('banking') || lower.includes('credit union')) {
      return 'bank';
    }
    if (lower.includes('insurance') || lower.includes('insurer')) {
      return 'insurance';
    }
  }
  return 'other';
}

/**
 * Detect regulator status from various fields.
 */
function detectRegulatorStatus(record: Record<string, unknown>): string | null {
  const statusKeys = ['status', 'regulatorStatus', 'regulator_status', 'regulatoryStatus', 'memberStatus'];
  const status = getField<string>(record, statusKeys);
  if (status) {
    const normalized = status.toLowerCase().trim();
    if (normalized.includes('active') || normalized.includes('in good standing')) {
      return 'active';
    }
    if (normalized.includes('inactive') || normalized.includes('suspended')) {
      return 'inactive';
    }
    if (normalized.includes('ceased') || normalized.includes('terminated')) {
      return 'ceased';
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  OSFI Parser                                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse a single OSFI (Office of Superintendent of Financial Institutions) record.
 *
 * Extracts:
 *   - Institution name and category (bank/insurance)
 *   - Assets under management
 *   - Capital adequacy ratio
 *   - Domestic stability buffer
 *   - Regulator status
 *
 * @param record - Raw CKAN record from OSFI data source
 * @param options - Parsing options
 * @returns BankData | InsuranceData | null
 */
export async function parseOSFIRecord(
  record: Record<string, unknown>,
  options: {
    sourceUrl?: string;
    date?: string;
  } = {},
): Promise<BankData | InsuranceData | null> {
  try {
    const now = new Date().toISOString();
    const institutionName = normalizeName(
      getField<string>(record, ['institutionName', 'institution_name', 'name', 'companyName', 'title']),
    );
    const institutionType = getField<string>(record, ['institutionType', 'institution_type', 'category', 'type']) ?? '';
    const category = detectInstitutionCategory(record);

    // Financial metrics
    const assetsUnderManagement = parseNumeric(
      getField<unknown>(record, ['totalAssets', 'total_assets', 'assets', 'assetsUnderManagement']),
    );
    const capitalAdequacyRatio = parseNumeric(
      getField<unknown>(record, ['capitalRatio', 'capital_ratio', 'capitalAdequacyRatio', 'CAR']),
    );
    const domesticStabilityBuffer = parseNumeric(
      getField<unknown>(record, ['domesticStabilityBuffer', 'stabilityBuffer', 'DSB']),
    );

    // Metadata
    const url = getField<string>(record, ['url', 'link', 'sourceUrl']) ?? options.sourceUrl ?? '';
    const date = getField<string>(record, ['date', 'reportingDate', 'reporting_date', 'fiscalDate']) ?? options.date ?? now.substring(0, 10);
    const source = `OSFI — ${OSFI_BASE}`;

    // Create hash for deduplication
    const hashContent = `osfi|${institutionName}|${institutionType}|${date}`;
    const id = await computeHash(hashContent, 'sha256');

    // Return appropriate type based on category
    if (category === 'bank') {
      return {
        id,
        institutionName,
        institutionType: institutionType || 'bank',
        assetsUnderManagement,
        capitalAdequacyRatio,
        domesticStabilityBuffer,
        jurisdiction: 'federal',
        source,
        url,
        date,
      };
    } else if (category === 'insurance') {
      return {
        id,
        companyName: institutionName,
        sector: institutionType || 'insurance',
        totalAssets: assetsUnderManagement,
        premiumsWritten: parseNumeric(getField<unknown>(record, ['premiumsWritten', 'premiums_written'])),
        jurisdiction: 'federal',
        source,
        url,
        date,
      };
    }

    // Default to bank if unknown
    return {
      id,
      institutionName,
      institutionType: institutionType || 'bank',
      assetsUnderManagement,
      capitalAdequacyRatio,
      domesticStabilityBuffer,
      jurisdiction: 'federal',
      source,
      url,
      date,
    };
  } catch (err) {
    console.warn(`[FinReg Parser] Skipping OSFI record: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  CDIC Parser                                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse a single CDIC (Canada Deposit Insurance Corporation) record.
 *
 * Extracts:
 *   - Member institution name
 *   - Member category
 *   - Premium class
 *   - Coverage limit
 *   - Member status
 *
 * @param record - Raw CKAN record from CDIC data source
 * @param options - Parsing options
 * @returns CDICMember | null
 */
export async function parseCDICRecord(
  record: Record<string, unknown>,
  options: {
    sourceUrl?: string;
    date?: string;
  } = {},
): Promise<CDICMember | null> {
  try {
    const now = new Date().toISOString();
    const institutionName = normalizeName(
      getField<string>(record, ['institutionName', 'institution_name', 'name', 'memberName', 'member_name', 'companyName']),
    );
    const memberCategory = getField<string>(record, ['memberCategory', 'member_category', 'category', 'type']) ?? '';
    const premiumClass = getField<string>(record, ['premiumClass', 'premium_class', 'class']);
    const coverageLimit = parseNumeric(
      getField<unknown>(record, ['coverageLimit', 'coverage_limit', 'limit', 'maxCoverage']),
    );

    // Metadata
    const url = getField<string>(record, ['url', 'link', 'sourceUrl']) ?? options.sourceUrl ?? '';
    const date = getField<string>(record, ['date', 'reportingDate', 'reporting_date']) ?? options.date ?? now.substring(0, 10);
    const source = `CDIC — ${CDIC_BASE}`;

    // Create hash for deduplication
    const hashContent = `cdic|${institutionName}|${memberCategory}|${date}`;
    const id = await computeHash(hashContent, 'sha256');

    return {
      id,
      institutionName,
      memberCategory: memberCategory || 'other',
      premiumClass: premiumClass || undefined,
      coverageLimit: coverageLimit ?? undefined,
      jurisdiction: 'federal',
      source,
      url,
    };
  } catch (err) {
    console.warn(`[FinReg Parser] Skipping CDIC record: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  FCAC Parser                                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse a single FCAC (Financial Consumer Agency of Canada) complaint record.
 *
 * Extracts:
 *   - Institution name
 *   - Complaint type and category
 *   - Complaint count
 *   - Year
 *   - Outcome and resolution
 *
 * @param record - Raw CKAN record from FCAC data source
 * @param options - Parsing options
 * @returns Complaint | null
 */
export async function parseFCACRecord(
  record: Record<string, unknown>,
  options: {
    sourceUrl?: string;
    date?: string;
  } = {},
): Promise<Complaint | null> {
  try {
    const now = new Date().toISOString();
    const institutionName = normalizeName(
      getField<string>(record, ['companyName', 'company_name', 'institutionName', 'institution_name', 'name', 'bank', 'financialInstitution']),
    );
    const complaintType = getField<string>(record, ['complaintType', 'complaint_type', 'type', 'complaintCategory', 'complaint_category']) ?? '';
    const category = getField<string>(record, ['category', 'sector', 'industry']) ?? 'banking';
    const count = parseNumeric(getField<unknown>(record, ['count', 'numberOfComplaints', 'number_of_complaints', 'complaints', 'volume']));
    const year = parseNumeric(getField<unknown>(record, ['year', 'fiscalYear', 'fiscal_year']));

    // Metadata
    const url = getField<string>(record, ['url', 'link', 'sourceUrl']) ?? options.sourceUrl ?? '';
    const date = getField<string>(record, ['date', 'reportingDate', 'reporting_date']) ?? options.date ?? now.substring(0, 10);
    const source = `FCAC — ${FCAC_BASE}`;

    // Create hash for deduplication
    const hashContent = `fcac|${institutionName}|${complaintType}|${year}|${date}`;
    const id = await computeHash(hashContent, 'sha256');

    return {
      id,
      institutionName,
      complaintType: complaintType || 'other',
      count: count ?? 0,
      year: year ?? new Date().getFullYear(),
      category,
      jurisdiction: 'federal',
      source,
      url,
    };
  } catch (err) {
    console.warn(`[FinReg Parser] Skipping FCAC record: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Batch Parser                                                       */
/* ------------------------------------------------------------------ */

/**
 * Batch parse financial regulation records with deduplication.
 *
 * This function routes records to the appropriate parser based on their
 * source (OSFI, CDIC, or FCAC) and handles deduplication using SHA-256 hashes.
 *
 * @param rawRecords - Array of raw CKAN records from financial regulators
 * @param options - Parsing options
 * @returns Parsed records array (BankData | InsuranceData | CDICMember | Complaint)
 */
export async function parseFinancialRegulationRecords(
  rawRecords: Array<{ source: string; data: Record<string, unknown> }>,
  options: {
    sourceUrl?: string;
    date?: string;
  } = {},
): Promise<Array<BankData | InsuranceData | CDICMember | Complaint>> {
  const results: Array<BankData | InsuranceData | CDICMember | Complaint> = [];
  const seenHashes = new Set<string>();

  for (const { source, data } of rawRecords) {
    try {
      let parsed: BankData | InsuranceData | CDICMember | Complaint | null = null;

      // Route to appropriate parser based on source
      const sourceLower = source.toLowerCase();
      if (sourceLower === 'osfi') {
        parsed = await parseOSFIRecord(data, options);
      } else if (sourceLower === 'cdic') {
        parsed = await parseCDICRecord(data, options);
      } else if (sourceLower === 'fcac') {
        parsed = await parseFCACRecord(data, options);
      }

      // Skip if parsing failed or duplicate
      if (!parsed) continue;
      if (seenHashes.has(parsed.id)) continue;
      seenHashes.add(parsed.id);

      results.push(parsed);
    } catch (err) {
      console.warn(
        `[FinReg Parser] Skipping record from ${source}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return results;
}

/**
 * Parse a generic FinRegRecord from CKAN data.
 * Used for general regulatory documents and notices.
 *
 * @param record - Raw CKAN record
 * @param regulator - Regulator name (OSFI, CDIC, FCAC)
 * @param options - Parsing options
 * @returns FinRegRecord | null
 */
export async function parseGenericFinRegRecord(
  record: Record<string, unknown>,
  regulator: string,
  options: {
    sourceUrl?: string;
    date?: string;
    category?: string;
  } = {},
): Promise<FinRegRecord | null> {
  try {
    const now = new Date().toISOString();
    const title = getField<string>(record, ['title', 'name', 'subject']) ?? '';
    const description = getField<string>(record, ['description', 'notes', 'summary', 'abstract']) ?? '';
    const url = getField<string>(record, ['url', 'link', 'sourceUrl']) ?? options.sourceUrl ?? '';
    const date = getField<string>(record, ['date', 'publishedDate', 'published_date', 'metadata_created']) ?? options.date ?? now.substring(0, 10);
    const category = options.category ?? 'financial-regulation';

    // Create hash for deduplication
    const hashContent = `finreg|${regulator}|${title}|${date}`;
    const id = await computeHash(hashContent, 'sha256');

    return {
      id,
      regulator: regulator.toUpperCase(),
      title,
      description: description.substring(0, 500), // Limit description length
      url,
      date,
      category,
      jurisdiction: 'federal',
    };
  } catch (err) {
    console.warn(`[FinReg Parser] Skipping generic record: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}