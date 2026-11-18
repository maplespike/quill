// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Health Canada Parser — Quill
 *
 * Normalizes raw Health Canada product records from DPD (drugs), MDALL (devices),
 * LNHP (natural products), and Recalls & Safety Alerts into the unified
 * HealthCanadaRecord schema.
 *
 * Each record is assigned a SHA-256 content hash for deduplication.
 */

import { computeHash } from '../../verification/hashing.js';
import { HC_LICENSE_STATUS_MAP } from './constants.js';
import type {
  HealthCanadaRecord,
  HealthCanadaProductType,
  HealthCanadaLicenseStatus,
  RawHealthCanadaRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Status Normalization                                               */
/* ------------------------------------------------------------------ */

/**
 * Normalize a raw license status string to the unified HealthCanadaLicenseStatus.
 */
export function normalizeLicenseStatus(
  raw: string | null | undefined,
): HealthCanadaLicenseStatus {
  if (!raw) return 'unknown';

  const trimmed = raw.trim().toLowerCase();

  const mapped = HC_LICENSE_STATUS_MAP[trimmed];
  if (mapped) return mapped;

  // Partial matching
  if (trimmed.includes('active') || trimmed.includes('market')) return 'active';
  if (trimmed.includes('suspend')) return 'suspended';
  if (trimmed.includes('revoke')) return 'revoked';
  if (trimmed.includes('cancel')) return 'cancelled';
  if (trimmed.includes('expire')) return 'expired';
  if (trimmed.includes('discontinue')) return 'discontinued';
  if (trimmed.includes('recall')) return 'recalled';
  if (trimmed.includes('pending') || trimmed.includes('review')) return 'pending';

  return 'unknown';
}

/**
 * Normalize a raw product type string to HealthCanadaProductType.
 */
export function normalizeProductType(
  raw: string | null | undefined,
): HealthCanadaProductType {
  if (!raw) return 'drug'; // default

  const trimmed = raw.trim().toLowerCase();

  switch (trimmed) {
    case 'drug':
    case 'pharmaceutical':
    case 'medicine':
      return 'drug';
    case 'device':
    case 'medical device':
    case 'medical_device':
      return 'device';
    case 'natural':
    case 'natural product':
    case 'natural_health_product':
    case 'nhp':
      return 'natural';
    case 'recall':
    case 'safety alert':
    case 'advisory':
      return 'recall';
    default:
      return 'drug';
  }
}

/* ------------------------------------------------------------------ */
/*  Date Normalization                                                 */
/* ------------------------------------------------------------------ */

/**
 * Normalize various date formats to ISO-8601 (YYYY-MM-DD).
 */
function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }

  // RFC 2822 / RSS pubDate: "Mon, DD Mon YYYY HH:MM:SS GMT"
  const rfcMatch = trimmed.match(
    /^\w{3},\s+(\d{1,2})\s+(\w{3})\s+(\d{4})/,
  );
  if (rfcMatch) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const day = rfcMatch[1].padStart(2, '0');
    const month = months[rfcMatch[2].toLowerCase()] ?? '01';
    const year = rfcMatch[3];
    return `${year}-${month}-${day}`;
  }

  // "YYYY/MM/DD" format
  const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`;
  }

  // "DD/MM/YYYY" or "MM/DD/YYYY" — prefer YYYY-MM-DD if year detected
  const dayMonthMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dayMonthMatch) {
    return `${dayMonthMatch[3]}-${dayMonthMatch[2].padStart(2, '0')}-${dayMonthMatch[1].padStart(2, '0')}`;
  }

  // "Month DD, YYYY"
  const textDateMatch = trimmed.match(
    /^(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
  );
  if (textDateMatch) {
    const months: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
      jan: '01', feb: '02', mar: '03', apr: '04', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const month = months[textDateMatch[1].toLowerCase()] ?? '01';
    const day = textDateMatch[2].padStart(2, '0');
    const year = textDateMatch[3];
    return `${year}-${month}-${day}`;
  }

  return trimmed.substring(0, 10);
}

/* ------------------------------------------------------------------ */
/*  Raw HealthCanada Record → HealthCanadaRecord                       */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw Health Canada record into a normalized HealthCanadaRecord.
 *
 * @param raw - Raw record from any Health Canada source
 * @param options - Parsing options
 * @returns Normalized HealthCanadaRecord or null if invalid
 */
export async function parseProductRecord(
  raw: RawHealthCanadaRecord,
  options: {
    sourceSystem?: string;
    productType?: HealthCanadaProductType;
    ingestedAt?: string;
  } = {},
): Promise<HealthCanadaRecord | null> {
  const productName = raw.productName ?? '';
  if (!productName) return null;

  const productType = options.productType ?? normalizeProductType(raw.productType);
  const licenseNumber = raw.licenseNumber ?? null;
  const licenseStatus = normalizeLicenseStatus(raw.licenseStatus);
  const manufacturer = raw.manufacturer ?? null;
  const therapeuticArea = raw.therapeuticArea ?? null;
  const activeIngredient = raw.activeIngredient ?? null;
  const din = raw.din ?? null;
  const npn = raw.npn ?? null;
  const licenseDate = normalizeDate(raw.licenseDate);
  const expiryDate = normalizeDate(raw.expiryDate);
  const recallSeverity = raw.recallSeverity ?? null;
  const recallReason = raw.recallReason ?? null;
  const recallClassification = raw.recallClassification ?? null;
  const dosageForm = raw.dosageForm ?? null;
  const routeOfAdministration = raw.routeOfAdministration ?? null;
  const companyStatus = raw.companyStatus ?? null;
  const sourceUrl = raw.sourceUrl ?? '';
  const sourceSystem = options.sourceSystem ?? raw.sourceSystem ?? 'unknown';
  const now = options.ingestedAt ?? new Date().toISOString();

  // Build content hash from normalized fields
  const contentForHash = JSON.stringify({
    productName,
    productType,
    licenseNumber,
    licenseStatus,
    manufacturer,
    therapeuticArea,
    activeIngredient,
    din,
    npn,
    licenseDate,
    expiryDate,
    dosageForm,
    routeOfAdministration,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    productName,
    productType,
    licenseNumber,
    licenseStatus,
    manufacturer,
    therapeuticArea,
    activeIngredient,
    din,
    npn,
    licenseDate,
    expiryDate,
    recallSeverity,
    recallReason,
    recallClassification,
    dosageForm,
    routeOfAdministration,
    companyStatus,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/*  Batch Parsing                                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse a batch of raw Health Canada records.
 *
 * @param rawRecords - Array of raw records from any Health Canada source
 * @param options - Parsing options
 * @returns Array of parsed HealthCanadaRecords (invalid records filtered out)
 */
export async function parseProductBatch(
  rawRecords: RawHealthCanadaRecord[],
  options: {
    sourceSystem?: string;
    productType?: HealthCanadaProductType;
    ingestedAt?: string;
  } = {},
): Promise<HealthCanadaRecord[]> {
  const results: HealthCanadaRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseProductRecord(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}
