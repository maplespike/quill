/**
 * Proactive Disclosure Parser — Quill
 *
 * Normalizes raw CKAN Solr search results from different department
 * schema formats into a unified ProactiveDisclosureRecord structure.
 *
 * Each Canadian federal department publishes proactive disclosure data
 * using different field names and formats. This parser handles the
 * most common variations and normalizes them to a standard schema.
 *
 * Field name mappings are department-aware: some departments use
 * "vendor_name", others use "supplier_name" or "contract_holder_name".
 * Department-specific mapping strategies are applied based on the
 * detected department (from owner_org or org_title_at_publication).
 */

import { computeHash } from '../../verification/hashing.js';
import {
  MAJOR_DEPARTMENTS,
  OWNER_ORG_ACRONYM_MAP,
  DEPARTMENT_ACRONYM_MAP,
  PDError,
} from './constants.js';
import type {
  ProactiveDisclosureRecord,
  RawCKANProactiveDisclosureDoc,
} from './types.js';


/* ------------------------------------------------------------------ */
/*  Department Detection Helper Functions                              */
/* ------------------------------------------------------------------ */

/**
 * Detect the department from a raw CKAN document.
 * Tries multiple field names in order of reliability.
 */
export function detectDepartment(raw: RawCKANProactiveDisclosureDoc): {
  name: string;
  acronym: string | null;
  ownerOrg: string | null;
} {
  // Try owner_org first (most reliable for CKAN)
  const ownerOrg = raw.owner_org ?? null;

  // Try department title fields
  const titleField = raw.org_title_at_publication
    ?? raw.owner_org_title
    ?? raw.department_name_en
    ?? raw.department
    ?? null;

  // Try acronym field
  const acronymField = raw.owner_acronym
    ?? raw.department_acronym
    ?? raw.acronym
    ?? null;

  // Resolve: lookup owner_org in our known departments
  if (ownerOrg && OWNER_ORG_ACRONYM_MAP[ownerOrg]) {
    const acronym = OWNER_ORG_ACRONYM_MAP[ownerOrg];
    const dept = MAJOR_DEPARTMENTS.find((d) => d.acronym === acronym);
    return {
      name: dept?.nameEn ?? titleField ?? ownerOrg,
      acronym: dept?.acronym ?? acronymField ?? acronym,
      ownerOrg,
    };
  }

  // Resolve: check if acronym field matches
  if (acronymField && DEPARTMENT_ACRONYM_MAP[acronymField]) {
    const dept = MAJOR_DEPARTMENTS.find((d) => d.acronym === acronymField);
    return {
      name: dept?.nameEn ?? titleField ?? acronymField,
      acronym: acronymField,
      ownerOrg: dept?.ownerOrg ?? ownerOrg,
    };
  }

  // Fallback: use the title field as-is
  return {
    name: titleField ?? ownerOrg ?? 'Unknown Department',
    acronym: acronymField,
    ownerOrg,
  };
}


/* ------------------------------------------------------------------ */
/*  Value Extraction Helpers                                           */
/* ------------------------------------------------------------------ */

/**
 * Extract a string field from a raw document, trying multiple possible
 * field names in order. Returns the first non-null/non-empty match.
 */
function extractString(
  raw: RawCKANProactiveDisclosureDoc,
  fieldNames: string[],
): string | null {
  for (const name of fieldNames) {
    const val = raw[name];
    if (val !== undefined && val !== null && val !== '') {
      return String(val).trim();
    }
  }
  return null;
}

/**
 * Extract a numeric value from a raw document, trying multiple
 * possible field names.
 */
function extractNumber(
  raw: RawCKANProactiveDisclosureDoc,
  fieldNames: string[],
): number | null {
  for (const name of fieldNames) {
    const val = raw[name];
    if (val !== undefined && val !== null && val !== '') {
      // Already a number
      if (typeof val === 'number' && !isNaN(val)) {
        return val;
      }
      // Try parsing string
      const strVal = String(val).trim();
      const cleaned = strVal.replace(/[$,\s]/g, '');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

/**
 * Extract a date string, normalizing common formats to ISO-8601 (YYYY-MM-DD).
 */
function extractDate(
  raw: RawCKANProactiveDisclosureDoc,
  fieldNames: string[],
): string | null {
  const val = extractString(raw, fieldNames);
  if (!val) return null;

  return normalizeDate(val);
}

/**
 * Normalize a date string to ISO-8601 (YYYY-MM-DD).
 * Handles multiple common formats found across department datasets.
 */
export function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Already ISO-8601
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // YYYY/MM/DD
  const slashMatch = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2]}-${slashMatch[3]}`;
  }

  // MM/DD/YYYY or DD/MM/YYYY (heuristic: if first part > 12, it's DD)
  const usMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (usMatch) {
    const p1 = parseInt(usMatch[1], 10);
    const p2 = parseInt(usMatch[2], 10);
    if (p1 > 12) {
      // DD/MM/YYYY
      return `${usMatch[3]}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    }
    // MM/DD/YYYY
    return `${usMatch[3]}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
  }

  // "Month Day, Year" — parse via Date constructor
  const monthDayYear = dateStr.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (monthDayYear) {
    const d = new Date(`${monthDayYear[1]} ${monthDayYear[2]}, ${monthDayYear[3]}`);
    return isNaN(d.getTime()) ? null : d.toISOString().substring(0, 10);
  }

  // "DD-Mon-YYYY" (e.g. "01-Jan-2024")
  const dmyMatch = dateStr.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})/);
  if (dmyMatch) {
    const d = new Date(`${dmyMatch[2]} ${dmyMatch[1]}, ${dmyMatch[3]}`);
    return isNaN(d.getTime()) ? null : d.toISOString().substring(0, 10);
  }

  // Return as-is — might be a partial date like "2024-2025" (fiscal year)
  return dateStr;
}


/* ------------------------------------------------------------------ */
/*  Core Parsing Logic                                                 */
/* ------------------------------------------------------------------ */

/**
 * Normalize a single raw CKAN proactive disclosure document into a
 * ProactiveDisclosureRecord, handling department-specific schema
 * variations.
 *
 * Field name mapping strategy:
 *   1. Try the most common field names first
 *   2. Fall back to department-specific field names
 *   3. Use null for fields that can't be mapped
 *
 * @param raw - Raw CKAN Solr document from any department
 * @returns Normalized ProactiveDisclosureRecord
 */
export async function parseCKAResult(
  raw: RawCKANProactiveDisclosureDoc,
): Promise<ProactiveDisclosureRecord> {
  const now = new Date().toISOString();

  // Detect department
  const dept = detectDepartment(raw);

  // --- Vendor Name (multiple schema variations) ---
  const vendorName = extractString(raw, [
    'vendor_name',
    'supplier_name',
    'supplier',
    'contract_holder_name',
    'name',
  ]) ?? 'Unknown Vendor';

  // --- Contract Value ---
  const contractValue = extractNumber(raw, [
    'contract_value',
    'value',
    'total_value',
    'contract_amount',
    'original_value',
  ]);

  // --- Award Date ---
  const awardDate = extractDate(raw, [
    'award_date',
    'date',
    'contract_date',
    'start_date',
  ]);

  // --- Description ---
  const description = extractString(raw, [
    'description',
    'notes',
    'commodity_description',
    'goods_services_description',
    'description_fr',
  ]);

  // --- Goods or Services ---
  const goodsOrServices = extractString(raw, [
    'goods_or_services',
    'commodity_type',
    'procurement_type',
  ]);

  // --- Procurement Method ---
  const procurementMethod = extractString(raw, [
    'procurement_method',
    'method',
    'method_of_supply',
  ]);

  // --- Contract Period ---
  const contractPeriodStart = extractDate(raw, [
    'contract_period_start',
    'start_date',
    'delivery_date',
  ]);

  const contractPeriodEnd = extractDate(raw, [
    'contract_period_end',
    'end_date',
    'expiry_date',
    'delivery_date',
  ]);

  // --- Comments ---
  const comments = extractString(raw, [
    'comments',
    'comments_en',
    'additional_comments',
    'amendment_comments',
  ]);

  // --- Source URL ---
  const sourceUrl = extractString(raw, [
    'url',
    'source_url',
    'resource_url',
  ]) ?? '';

  // --- Fiscal Year ---
  const fiscalYear = extractString(raw, [
    'fiscal_year',
    'fiscal_year_id',
  ]);

  // --- Currency ---
  const currency = 'CAD';

  // --- Build content for SHA-256 hash ---
  const contentForHash = [
    dept.name,
    vendorName,
    contractValue?.toString() ?? '',
    awardDate ?? '',
    description ?? '',
    sourceUrl,
  ].join('|');

  const id = await computeHash(contentForHash, 'sha256');

  const record: ProactiveDisclosureRecord = {
    id,
    department: dept.name,
    departmentAcronym: dept.acronym,
    vendorName,
    contractValue,
    currency,
    awardDate,
    description,
    goodsOrServices,
    procurementMethod,
    contractPeriodStart,
    contractPeriodEnd,
    comments,
    sourceUrl,
    ckanPackageId: raw.package_id ?? raw.id ?? null,
    ckanResourceId: raw.resource_id ?? null,
    fiscalYear,
    ingestedAt: now,
  };

  return record;
}


/**
 * Parse multiple raw CKAN results into an array of normalized records.
 * Handles deduplication by SHA-256 hash.
 *
 * @param rawDocs - Array of raw CKAN documents
 * @returns Array of normalized ProactiveDisclosureRecord
 */
export async function parseCKAResults(
  rawDocs: RawCKANProactiveDisclosureDoc[],
): Promise<ProactiveDisclosureRecord[]> {
  const records: ProactiveDisclosureRecord[] = [];
  const seenHashes = new Set<string>();

  for (const raw of rawDocs) {
    try {
      const record = await parseCKAResult(raw);

      // Deduplicate by hash
      if (!seenHashes.has(record.id)) {
        seenHashes.add(record.id);
        records.push(record);
      }
    } catch (err) {
      // Log and skip records that fail to parse
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[PD Parser] Skipping record: ${msg}`);
    }
  }

  return records;
}


/**
 * Extract the fiscal year from a date string.
 * Government fiscal years run April 1 to March 31.
 * If the month is Jan-Mar, it's still the previous fiscal year.
 *
 * @param dateStr - ISO-8601 date string
 * @returns Fiscal year range string (e.g. "2024-2025") or null
 */
export function extractFiscalYear(dateStr: string | null): string | null {
  if (!dateStr) return null;

  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})/);
  if (!isoMatch) return null;

  const year = parseInt(isoMatch[1], 10);
  const month = parseInt(isoMatch[2], 10);

  // Fiscal year starts April 1
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = fyStart + 1;

  return `${fyStart}-${fyEnd}`;
}


/**
 * Infer goods/services classification from the description text.
 * Useful when the raw data doesn't include a goods_or_services field.
 *
 * @param description - Contract description text
 * @returns 'goods', 'services', 'construction', or null
 */
export function inferGoodsOrServices(
  description: string | null,
): string | null {
  if (!description) return null;

  const lower = description.toLowerCase();

  // Construction keywords
  const constructionKeywords = [
    'construction', 'renovation', 'building', 'infrastructure',
    'road', 'bridge', 'paving', 'excavation', 'demolition',
  ];
  if (constructionKeywords.some((kw) => lower.includes(kw))) {
    return 'construction';
  }

  // Goods keywords
  const goodsKeywords = [
    'supply', 'equipment', 'hardware', 'software license',
    'purchase', 'material', 'furniture', 'vehicle',
    'computer', 'printer', 'furnish',
  ];
  if (goodsKeywords.some((kw) => lower.includes(kw))) {
    return 'goods';
  }

  // Default to services
  return 'services';
}
