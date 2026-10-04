// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Quebec Health Parser — Quill
 *
 * Normalizes raw Quebec health records from RAMQ and INSPQ sources
 * into the unified RAMQRecord and QCHealthRecord schemas.
 *
 * Each record is assigned a SHA-256 content hash for deduplication.
 */

import { computeHash } from '../../verification/hashing.js';
import type {
  RAMQRecord,
  QCHealthRecord,
  RAMQRecordType,
  RawRAMQRecord,
  RawQCHealthRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Date Normalization                                                 */
/* ------------------------------------------------------------------ */

function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }

  const rfcMatch = trimmed.match(/^\w{3},\s+(\d{1,2})\s+(\w{3})\s+(\d{4})/);
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

  const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`;
  }

  const dayMonthMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dayMonthMatch) {
    return `${dayMonthMatch[3]}-${dayMonthMatch[2].padStart(2, '0')}-${dayMonthMatch[1].padStart(2, '0')}`;
  }

  return trimmed.substring(0, 10);
}

/* ------------------------------------------------------------------ */
/*  Raw RAMQ Record → RAMQRecord                                       */
/* ------------------------------------------------------------------ */

export async function parseRAMQRecord(
  raw: RawRAMQRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<RAMQRecord | null> {
  const sourceUrl = raw.source_url ?? '';
  if (!sourceUrl) return null;

  const claimType = raw.claim_type ?? null;
  const serviceCode = raw.service_code ?? null;
  const serviceDate = normalizeDate(raw.service_date);
  const providerType = raw.provider_type ?? null;
  const beneficiaryType = raw.beneficiary_type ?? null;
  const region = raw.region ?? null;
  const claimsCount = raw.claims_count ?? null;
  const totalPaid = raw.total_paid ?? null;
  const fiscalYear = raw.fiscal_year ?? null;
  const sourceSystem = options.sourceSystem ?? 'qc-ramq';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    claimType,
    serviceCode,
    serviceDate,
    providerType,
    beneficiaryType,
    region,
    claimsCount,
    totalPaid,
    fiscalYear,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    claimType,
    serviceCode,
    serviceDate,
    providerType,
    beneficiaryType,
    region,
    claimsCount,
    totalPaid,
    fiscalYear,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

export async function parseRAMQBatch(
  rawRecords: RawRAMQRecord[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<RAMQRecord[]> {
  const results: RAMQRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseRAMQRecord(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Raw QCHealth Record → QCHealthRecord                               */
/* ------------------------------------------------------------------ */

export async function parseQCHealthRecord(
  raw: RawQCHealthRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<QCHealthRecord | null> {
  const url = raw.url ?? '';
  if (!url) return null;

  const title = raw.title ?? null;
  const titleFr = raw.title_fr ?? raw.title ?? null;
  const topic = raw.topic ?? null;
  const publicationDate = normalizeDate(raw.publication_date);
  const summary = raw.summary ?? null;
  const sourceSystem = options.sourceSystem ?? 'qc-inspq';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    title,
    titleFr,
    topic,
    publicationDate,
    url,
    summary,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    title,
    titleFr,
    topic,
    publicationDate,
    url,
    summary,
    sourceSystem,
    ingestedAt: now,
  };
}

export async function parseQCHealthBatch(
  rawRecords: RawQCHealthRecord[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<QCHealthRecord[]> {
  const results: QCHealthRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseQCHealthRecord(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}