// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CIPO (Canadian Intellectual Property Office) Parser — Quill
 *
 * Normalizes raw CIPO patent, trademark, and industrial design records
 * into the unified CipoRecord schema.
 *
 * Each record is assigned a SHA-256 content hash for deduplication.
 */

import { computeHash } from '../../verification/hashing.js';
import { CIPO_STATUS_MAP, CIPO_SOURCES } from './constants.js';
import type {
  CipoRecord,
  CipoIpType,
  CipoStatus,
  RawCipoRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Status Normalization                                               */
/* ------------------------------------------------------------------ */

/**
 * Normalize a raw status string to the unified CipoStatus type.
 */
export function normalizeCipoStatus(
  raw: string | null | undefined,
): CipoStatus {
  if (!raw) return 'unknown';

  const trimmed = raw.trim().toLowerCase();

  // Direct map match
  const mapped = CIPO_STATUS_MAP[trimmed];
  if (mapped) return mapped;

  // Partial matching for common variants
  if (trimmed.includes('active') || trimmed.includes('grant') || trimmed.includes('issue')) return 'active';
  if (trimmed.includes('pend') || trimmed.includes('examin')) return 'pending';
  if (trimmed.includes('abandon')) return 'abandoned';
  if (trimmed.includes('expir')) return 'expired';
  if (trimmed.includes('refus')) return 'refused';
  if (trimmed.includes('withdraw')) return 'withdrawn';
  if (trimmed.includes('oppos')) return 'opposed';
  if (trimmed.includes('expung') || trimmed.includes('remov')) return 'expunged';

  return 'unknown';
}

/**
 * Normalize a raw IP type string to CipoIpType.
 */
export function normalizeCipoType(
  raw: string | null | undefined,
): CipoIpType {
  if (!raw) return 'patent';

  const trimmed = raw.trim().toLowerCase();

  switch (trimmed) {
    case 'patent':
    case 'patents':
    case 'pat':
      return 'patent';
    case 'trademark':
    case 'trade-mark':
    case 'trademarks':
    case 'tm':
    case 'mark':
      return 'trademark';
    case 'industrial_design':
    case 'industrial design':
    case 'design':
    case 'id':
      return 'industrial_design';
    default:
      return 'patent';
  }
}

/* ------------------------------------------------------------------ */
/*  Raw CIPO Record → CipoRecord                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw CIPO record into a normalized CipoRecord.
 *
 * @param raw - Raw CIPO record object
 * @param options - Parsing options
 * @returns Normalized CipoRecord or null if invalid
 */
export async function parseCipoRecord(
  raw: RawCipoRecord,
  options: {
    sourceSystem?: string;
    ipType?: CipoIpType;
    ingestedAt?: string;
  } = {},
): Promise<CipoRecord | null> {
  const applicationNumber = raw.applicationNumber ?? '';
  const title = raw.title ?? '';
  if (!applicationNumber && !title) return null;

  const ipType = options.ipType ?? normalizeCipoType(raw.type);
  const sourceSystem = options.sourceSystem ?? `cipo-${ipType}`;
  const now = options.ingestedAt ?? new Date().toISOString();

  const status = normalizeCipoStatus(raw.status);
  const filingDate = raw.filingDate ?? null;
  const ownerName = raw.ownerName ?? null;
  const agentName = raw.agentName ?? null;
  const ipcClassification = raw.ipcClassification ?? null;
  const niceClassification = raw.niceClassification ?? null;
  const registrationDate = raw.registrationDate ?? null;
  const expiryDate = raw.expiryDate ?? null;
  const publicationDate = raw.publicationDate ?? null;
  const description = raw.description ?? null;

  const sourceUrl = raw.sourceUrl ?? (
    ipType === 'patent' ? CIPO_SOURCES.PATENT.SEARCH
    : ipType === 'trademark' ? CIPO_SOURCES.TRADEMARK.SEARCH
    : CIPO_SOURCES.DESIGN.SEARCH
  );

  // Build content hash from normalized fields
  const contentForHash = JSON.stringify({
    applicationNumber,
    filingDate,
    status,
    ipType,
    title,
    ownerName,
    agentName,
    ipcClassification,
    niceClassification,
    registrationDate,
    expiryDate,
    publicationDate,
    description,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    applicationNumber,
    filingDate,
    status,
    type: ipType,
    title,
    ownerName,
    agentName,
    ipcClassification,
    niceClassification,
    registrationDate,
    expiryDate,
    publicationDate,
    description,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/*  Batch Parsing                                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse a batch of raw CIPO records.
 *
 * @param rawRecords - Array of raw records from CIPO sources
 * @param options - Parsing options
 * @returns Array of parsed CipoRecords (invalid records filtered out)
 */
export async function parseCipoBatch(
  rawRecords: RawCipoRecord[],
  options: {
    sourceSystem?: string;
    ipType?: CipoIpType;
    ingestedAt?: string;
  } = {},
): Promise<CipoRecord[]> {
  const results: CipoRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseCipoRecord(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}
