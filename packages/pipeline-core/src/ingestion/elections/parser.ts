// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Elections Canada Third-Party Advertiser Registry Parser — Quill
 *
 * Parses raw third-party advertiser records from Elections Canada CSV exports,
 * CKAN datasets, and HTML scraping into structured ThirdPartyAd objects.
 *
 * Handles:
 *   - CSV row parsing for financial reports and registrations
 *   - Registrant type categorization (union/corporation/issue-group/individual)
 *   - Advertising platform detection
 *   - Electoral district targeting extraction
 *   - Issue focus extraction
 *   - Cross-reference support with influence tracking and corporate modules
 *   - SHA-256 content hashing for record identification
 */

import { computeHash } from '../../verification/hashing.js';
import {
  TYPE_STRING_MAP,
  PLATFORM_KEYWORDS,
} from './constants.js';
import { TRACKED_INFLUENCE_ACTORS } from '../influence/constants.js';
import type { InfluenceActor } from '../influence/types.js';
import { TRACKED_EXECUTIVES } from '../corporate/constants.js';
import type { TrackedExecutive } from '../corporate/constants.js';
import type {
  ThirdPartyAd,
  ThirdPartySpending,
  ThirdPartyType,
  AdvertisingPlatform,
  ElectionPeriod,
  ElectionPeriodType,
  ElectionsIngestionResult,
  RawThirdPartyRecord,
  RawThirdPartySpendingRecord,
} from './types.js';

import { parseCsvLine } from '../../utils/csv.js';

/**
 * Categorize a registrant by its type string from Elections Canada.
 *
 * Examines the raw type descriptor and maps it to one of the canonical
 * ThirdPartyType values: union, corporation, issue-group, individual, other.
 *
 * Also examines the registrant name for corporate suffixes if no explicit
 * type is provided.
 */
export function categorizeByType(
  registrantName: string,
  rawType: string | null | undefined,
): ThirdPartyType {
  // If we have an explicit type, map it
  if (rawType) {
    const normalized = rawType.toLowerCase().trim();
    for (const [key, value] of Object.entries(TYPE_STRING_MAP)) {
      if (normalized.includes(key)) {
        return value as ThirdPartyType;
      }
    }
  }

  // Heuristic: examine registrant name for corporate indicators
  if (registrantName) {
    const name = registrantName.toLowerCase().trim();

    // Union indicators
    if (
      name.includes('union') ||
      name.includes('syndicat') ||
      name.includes('labour') ||
      name.includes('travailleurs') ||
      name.includes('brotherhood') ||
      name.includes('international union') ||
      name.includes('local ') ||
      name.includes('uaw') ||
      name.includes('teamsters')
    ) {
      return 'union';
    }

    // Corporate indicators
    if (
      name.includes('inc.') ||
      name.includes('inc ') ||
      name.includes('ltd.') ||
      name.includes('limited') ||
      name.includes('corp.') ||
      name.includes('corporation') ||
      name.includes('llc') ||
      name.includes('co.') ||
      name.includes('company') ||
      name.match(/\b(corp|inc|ltd)\b/i)
    ) {
      return 'corporation';
    }

    // Individual indicators
    if (
      name.includes('mr. ') ||
      name.includes('mrs. ') ||
      name.includes('ms. ') ||
      name.includes('dr. ') ||
      name.match(/^[a-z]+\s+[a-z]+$/) // simple first+last name pattern
    ) {
      return 'individual';
    }
  }

  return 'other';
}


/**
 * Detect advertising platforms from a raw platform string.
 * The raw string could be comma-separated, semicolon-separated, or free text.
 */
export function detectPlatforms(raw: string | null | undefined): AdvertisingPlatform[] {
  if (!raw || raw.trim().length === 0) {
    // Default to 'other' when no platform info available
    return ['other'];
  }

  const platforms = new Set<AdvertisingPlatform>();
  const lower = raw.toLowerCase();

  for (const [keyword, platform] of Object.entries(PLATFORM_KEYWORDS)) {
    if (lower.includes(keyword)) {
      platforms.add(platform as AdvertisingPlatform);
    }
  }

  return platforms.size > 0 ? Array.from(platforms) : ['other'];
}


/**
 * Detect election period type from a raw period string.
 */
export function detectElectionPeriod(
  rawType: string | null | undefined,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): ElectionPeriod {
  const type = detectElectionPeriodType(rawType, startDate, endDate);
  return {
    type,
    electionName: null,
    startDate: startDate ?? null,
    endDate: endDate ?? null,
  };
}

function detectElectionPeriodType(
  rawType: string | null | undefined,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): ElectionPeriodType {
  if (rawType) {
    const lower = rawType.toLowerCase().trim();
    if (lower.includes('pre-election') || lower.includes('pre election') || lower.includes('pre')) {
      return 'pre-election';
    }
    if (lower.includes('election') || lower.includes('general') || lower.includes('writ')) {
      return 'election';
    }
    if (lower.includes('between') || lower.includes('non-election') || lower.includes('other')) {
      return 'between-elections';
    }
  }

  // Heuristic: dates within 60 days of a known general election date
  // Default to election period if dates suggest it
  return 'election';
}




/**
 * Parse a CSV header row to build a column index.
 */
export function parseCsvHeader(headerLine: string): Map<string, number> {
  const headers = parseCsvLine(headerLine);
  const colIndex = new Map<string, number>();
  for (let i = 0; i < headers.length; i++) {
    const clean = headers[i].toLowerCase().replace(/[^a-z0-9_]/g, '_');
    colIndex.set(clean, i);
    // Also add without the cleaning
    colIndex.set(headers[i].toLowerCase(), i);
  }
  return colIndex;
}


/**
 * Safely access string field from RawThirdPartyRecord.
 */
function str(raw: RawThirdPartyRecord, ...keys: string[]): string {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return '';
}

/**
 * Parse a raw third-party advertiser record into a structured ThirdPartyAd.
 *
 * The raw record can come from CKAN CSV, Elections Canada HTML scraping,
 * or direct API responses.
 */
export async function parseThirdPartyAd(
  raw: RawThirdPartyRecord,
  options: {
    /** Override the source system */
    sourceSystem?: string;
    /** Override the CKAN package ID */
    ckanPackageId?: string;
    /** Override the CKAN resource ID */
    ckanResourceId?: string;
    /** Known influence actor cross-reference */
    influenceActorId?: string | null;
    /** Known corporate entity cross-reference */
    corporateEntityNumber?: string | null;
  } = {},
): Promise<ThirdPartyAd | null> {
  // Extract base fields
  const registrantName = str(raw, 'registrantName', 'registrant_name', 'name', 'client_name', 'organization');
  const rawType = str(raw, 'registrantType', 'registrant_type', 'type', 'entity_type');
  const address = str(raw, 'address', 'registrant_address', 'street_address') || null;
  const city = str(raw, 'city', 'registrant_city', 'municipality') || null;
  const province = str(raw, 'province', 'registrant_province', 'province_state', 'region') || null;
  const postalCode = str(raw, 'postalCode', 'postal_code', 'postal_zip') || null;
  const telephone = str(raw, 'telephone', 'registrant_telephone', 'phone', 'phone_number') || null;
  const officerName = str(raw, 'officerName', 'officer_name', 'responsible_officer', 'contact') || null;
  const officerTitle = str(raw, 'officerTitle', 'officer_title', 'title') || null;
  const registrationNumber = str(raw, 'registrationNumber', 'registration_number', 'reg_number', 'id') || null;
  const registrationDate = str(raw, 'registrationDate', 'registration_date', 'reg_date', 'date_registered') || null;
  const rawRidings = str(raw, 'targetedRidings', 'targeted_ridings', 'ridings', 'electoral_districts', 'constituencies');
  const rawIssues = str(raw, 'issueFocus', 'issue_focus', 'issues', 'subjects', 'topics');
  const rawPlatforms = str(raw, 'platforms', 'platform', 'media_types', 'advertising_platform');
  const rawPeriodType = str(raw, 'electionPeriodType', 'election_period_type', 'period_type');
  const periodStart = str(raw, 'periodStart', 'period_start', 'start_date', 'period_start_date') || null;
  const periodEnd = str(raw, 'periodEnd', 'period_end', 'end_date', 'period_end_date') || null;
  const totalSpendingStr = str(raw, 'totalSpending', 'total_spending', 'spending', 'amount', 'total_amount');
  const spendingLimitStr = str(raw, 'spendingLimit', 'spending_limit', 'limit', 'spending_limit_amount');

  // Skip empty records
  if (!registrantName) {
    return null;
  }

  // Parse structured fields
  const type = categorizeByType(registrantName, rawType);
  const platforms = detectPlatforms(rawPlatforms);
  const electionPeriod = detectElectionPeriod(rawPeriodType, periodStart, periodEnd);

  // Parse targeted ridings
  const targetedRidings: string[] = rawRidings
    ? rawRidings.split(/[;,|/]/).map(r => r.trim()).filter(Boolean)
    : [];

  // Parse issue focus
  const issueFocus: string[] = rawIssues
    ? rawIssues.split(/[;,|/]/).map(r => r.trim()).filter(Boolean)
    : [];

  // Parse amounts
  const totalSpending = parseAmount(totalSpendingStr);
  const spendingLimit = parseAmount(spendingLimitStr);

  // Build the record string for hashing
  const sourceSystem = (options.sourceSystem ?? str(raw, 'sourceSystem', 'source_system')) || 'elections-module';
  const recordForHash = JSON.stringify({
    registrantName,
    type,
    registrationNumber,
    registrationDate,
    totalSpending,
    electionPeriod,
    platforms,
    sourceSystem,
  });

  const sourceUrl = str(raw, 'sourceUrl', 'source_url', 'url');
  const ckanPackageId = (options.ckanPackageId ?? str(raw, 'ckanPackageId', 'ckan_package_id')) || null;
  const ckanResourceId = (options.ckanResourceId ?? str(raw, 'ckanResourceId', 'ckan_resource_id')) || null;

  const ad: ThirdPartyAd = {
    id: await computeHash(recordForHash, 'sha256'),

    registrantName,
    registrantType: type,

    address,
    city,
    province,
    postalCode,
    telephone,

    officerName,
    officerTitle,

    targetedRidings,
    issueFocus,
    platforms,
    electionPeriod,

    totalSpending,
    spendingLimit,

    registrationNumber,
    registrationDate,

    isTrackedInfluenceActor: options.influenceActorId !== null && options.influenceActorId !== undefined,
    influenceActorId: options.influenceActorId ?? null,
    isTrackedCorporateEntity: options.corporateEntityNumber !== null && options.corporateEntityNumber !== undefined,
    corporateEntityNumber: options.corporateEntityNumber ?? null,

    sourceUrl,
    sourceSystem,
    ckanPackageId,
    ckanResourceId,

    ingestedAt: new Date().toISOString(),
  };

  return ad;
}

/**
 * Parse a batch of raw third-party records into structured objects.
 */
export async function parseThirdPartyAds(
  rawRecords: RawThirdPartyRecord[],
  options: {
    sourceSystem?: string;
  } = {},
): Promise<ThirdPartyAd[]> {
  const results: ThirdPartyAd[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseThirdPartyAd(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}


/**
 * Parse a raw third-party spending record.
 */
export async function parseThirdPartySpending(
  raw: RawThirdPartySpendingRecord,
  options: {
    /** Override the source system */
    sourceSystem?: string;
  } = {},
): Promise<ThirdPartySpending | null> {
  const registrantName = val(raw.registrantName);
  const reportingPeriod = val(raw.reportingPeriod, raw.reporting_period);
  const platform = detectPlatforms(raw.platform ? String(raw.platform) : '');
  const amount = parseAmount(raw.amount ? String(raw.amount) : '');
  const spendingCategory = raw.spendingCategory ? String(raw.spendingCategory) : (raw.spending_category ? String(raw.spending_category) : null);
  const vendorName = raw.vendorName ? String(raw.vendorName) : (raw.vendor_name ? String(raw.vendor_name) : null);
  const targetedRiding = raw.targetedRiding ? String(raw.targetedRiding) : (raw.targeted_riding ? String(raw.targeted_riding) : null);
  const expenseDate = raw.expenseDate ? String(raw.expenseDate) : (raw.expense_date ? String(raw.expense_date) : null);
  const sourceUrl = raw.sourceUrl ? String(raw.sourceUrl) : (raw.source_url ? String(raw.source_url) : '');

  if (!registrantName || !reportingPeriod) {
    return null;
  }

  // Spending records must have a valid amount
  if (amount === null) {
    return null;
  }

  const sourceSystem = options.sourceSystem ?? 'elections-module';

  const recordForHash = JSON.stringify({
    registrantName,
    reportingPeriod,
    platform: platform[0],
    amount,
    expenseDate,
    vendorName,
    targetedRiding,
  });

  const spending: ThirdPartySpending = {
    id: await computeHash(recordForHash, 'sha256'),
    thirdPartyAdId: '', // Will be linked by the ingestion orchestrator
    registrantName,
    reportingPeriod,
    platform: platform[0],
    amount,
    spendingCategory,
    vendorName,
    targetedRiding,
    expenseDate,
    sourceUrl,
    sourceSystem,
    ingestedAt: new Date().toISOString(),
  };

  return spending;
}

/**
 * Parse a batch of raw spending records.
 */
export async function parseThirdPartySpendings(
  rawRecords: RawThirdPartySpendingRecord[],
  options: {
    sourceSystem?: string;
  } = {},
): Promise<ThirdPartySpending[]> {
  const results: ThirdPartySpending[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseThirdPartySpending(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }
  return results;
}


/**
 * Safely extract a string value from a field that may be unknown.
 */
function val(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
    if (typeof c === 'number') return String(c);
  }
  return '';
}


/**
 * Parse a full CSV text into raw third-party advertiser records.
 * Assumes the first row is a header.
 */
export function parseThirdPartyCSV(
  csvText: string,
  options: {
    /** Override the source URL for all records */
    sourceUrl?: string;
  } = {},
): RawThirdPartyRecord[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const colIndex = parseCsvHeader(lines[0]);
  const records: RawThirdPartyRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length === 0) continue;

    const record: RawThirdPartyRecord = {
      sourceUrl: options.sourceUrl ?? '',
    };

    // Map fields by column header
    const entries = Array.from(colIndex.entries());
    for (const [header, fieldValue] of entries) {
      if (fieldValue < fields.length) {
        const value = fields[fieldValue];
        if (value) {
          record[header] = value;
        }
      }
    }

    records.push(record);
  }

  return records;
}


/**
 * Parse a dollar amount string to a number.
 * Handles: "$1,000", "1,000.00", "$1,234.56 CAD", etc.
 */
function parseAmount(str: string | null | undefined): number | null {
  if (!str || str.trim().length === 0) return null;

  const cleaned = str
    .replace(/^[£$€¥¢]/g, '')  // Remove leading currency symbols
    .replace(/[,$€£¥\s]/g, '') // Remove commas, spaces, embedded symbols
    .replace(/\s*CAD\s*$/i, '') // Remove CAD suffix
    .replace(/\s*USD\s*$/i, '')
    .trim();

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : Math.round(parsed * 100) / 100;
}


/**
 * Check if a registrant name matches any known influence actors.
 * Does case-insensitive substring matching against the tracked
 * influence actor catalog (TRACKED_INFLUENCE_ACTORS from influence module).
 */
export function findMatchingInfluenceActor(
  registrantName: string,
): { matched: boolean; id: string | null } {
  if (!registrantName) {
    return { matched: false, id: null };
  }

  const lowerName = registrantName.toLowerCase();

  for (const actor of TRACKED_INFLUENCE_ACTORS) {
    // Check main name
    if (actor.name.toLowerCase().includes(lowerName) || lowerName.includes(actor.name.toLowerCase())) {
      return { matched: true, id: actor.id };
    }
    // Check aliases
    for (const alias of actor.aliases) {
      if (alias.toLowerCase().includes(lowerName) || lowerName.includes(alias.toLowerCase())) {
        return { matched: true, id: actor.id };
      }
    }
  }

  return { matched: false, id: null };
}

/**
 * Check if a registrant name matches any known corporate entities/executives.
 * Does case-insensitive substring matching against the tracked
 * executive catalog (TRACKED_EXECUTIVES from corporate module).
 */
export function findMatchingCorporateEntity(
  registrantName: string,
): { matched: boolean; number: string | null } {
  if (!registrantName) {
    return { matched: false, number: null };
  }

  const lowerName = registrantName.toLowerCase();

  for (const exec of TRACKED_EXECUTIVES) {
    // Check executive name
    if (exec.name.toLowerCase().includes(lowerName) || lowerName.includes(exec.name.toLowerCase())) {
      return { matched: true, number: exec.organizationTicker ?? exec.organization };
    }
    // Check organization name
    if (exec.organization.toLowerCase().includes(lowerName) || lowerName.includes(exec.organization.toLowerCase())) {
      return { matched: true, number: exec.organizationTicker ?? exec.organization };
    }
  }

  return { matched: false, number: null };
}
