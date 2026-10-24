// SPDX-License-Identifier: AGPL-3.0-only
/**
 * BC Health Parser — Quill
 *
 * Normalizes raw BC health data into unified schemas:
 *   - PharmaCareRecord for PharmaCare claims
 *   - BCCDCRecord for BC CDC publications
 *
 * Each record is assigned a SHA-256 content hash for deduplication.
 */

import { computeHash } from '../../verification/hashing.js';
import { BC_FORMULARY_STATUS_MAP } from './constants.js';
import type {
  PharmaCareRecord,
  BCCDCRecord,
  PharmaCareFormularyStatus,
  RawBCHealthRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Status Normalization                                               */
/* ------------------------------------------------------------------ */

export function normalizeFormularyStatus(
  raw: string | null | undefined,
): PharmaCareFormularyStatus {
  if (!raw) return 'non';

  const trimmed = raw.trim().toLowerCase();

  const mapped = BC_FORMULARY_STATUS_MAP[trimmed];
  if (mapped) return mapped;

  if (trimmed.includes('full')) return 'full';
  if (trimmed.includes('restrict')) return 'restricted';
  if (trimmed.includes('special authority')) return 'restricted';
  if (trimmed.includes('non') || trimmed.includes('not covered')) return 'non';

  return 'non';
}

/* ------------------------------------------------------------------ */
/*  Date Normalization                                                 */
/* ------------------------------------------------------------------ */

function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }

  const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`;
  }

  return trimmed.substring(0, 10);
}

/* ------------------------------------------------------------------ */
/*  Record Parsing                                                     */
/* ------------------------------------------------------------------ */

export async function parsePharmaCareRecord(
  raw: RawBCHealthRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<PharmaCareRecord | null> {
  const drugName = raw.drugName ?? '';
  if (!drugName) return null;

  const manufacturer = raw.manufacturer ?? null;
  const formularyStatus = normalizeFormularyStatus(raw.formularyStatus);
  const atcCode = raw.atcCode ?? null;
  const therapeuticCategory = raw.therapeuticCategory ?? null;
  const claimCount = typeof raw.claimCount === 'number' ? raw.claimCount : Number.parseInt(raw.claimCount?.toString() ?? '0', 10);
  const totalCost = typeof raw.totalCost === 'number' ? raw.totalCost : Number.parseFloat(raw.totalCost?.toString() ?? '0');
  const fiscalYear = raw.fiscalYear ?? '';
  const sourceUrl = raw.sourceUrl ?? '';
  const sourceSystem = options.sourceSystem ?? 'bc-pharmacare';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    drugName,
    manufacturer,
    formularyStatus,
    atcCode,
    therapeuticCategory,
    claimCount,
    totalCost,
    fiscalYear,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    drugName,
    manufacturer,
    formularyStatus,
    atcCode,
    therapeuticCategory,
    claimCount,
    totalCost,
    fiscalYear,
    sourceUrl,
    ingestedAt: now,
  };
}

export async function parseBCCDCRecord(
  raw: RawBCHealthRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<BCCDCRecord | null> {
  const title = raw.title ?? '';
  if (!title) return null;

  const topic = raw.topic ?? null;
  const publicationDate = normalizeDate(raw.publicationDate);
  const diseaseFocus = raw.diseaseFocus ?? null;
  const url = raw.url ?? raw.sourceUrl ?? '';
  const summary = raw.summary ?? null;
  const sourceUrl = raw.sourceUrl ?? url;
  const sourceSystem = options.sourceSystem ?? 'bc-cdc';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    title,
    topic,
    publicationDate,
    diseaseFocus,
    url,
    summary,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    title,
    topic,
    publicationDate,
    diseaseFocus,
    url,
    summary,
    ingestedAt: now,
  };
}

export async function parsePharmaCareBatch(
  rawRecords: RawBCHealthRecord[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<PharmaCareRecord[]> {
  const results: PharmaCareRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parsePharmaCareRecord(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}

export async function parseBCCDCBatch(
  rawRecords: RawBCHealthRecord[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<BCCDCRecord[]> {
  const results: BCCDCRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseBCCDCRecord(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}