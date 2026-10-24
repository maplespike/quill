// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { BcCourtsRecord, RawBcCourtsRecord } from './types.js';

export async function parseBcCourtsRecord(raw: RawBcCourtsRecord, options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<BcCourtsRecord | null> {
  const sourceUrl = raw.source_url ?? '';
  if (!sourceUrl) return null;

  const sourceSystem = options.sourceSystem ?? 'bc-courts';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    court_type: raw.court_type,
    file_number: raw.file_number,
    filing_date: raw.filing_date,
    case_type: raw.case_type,
    location: raw.location,
    status: raw.status,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    recordType: 'bc_court',
    courtType: raw.court_type ?? null,
    fileNumber: raw.file_number ?? null,
    filingDate: raw.filing_date ?? null,
    caseType: raw.case_type ?? null,
    location: raw.location ?? null,
    status: raw.status ?? null,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

export async function parseBcCourtsBatch(rawRecords: RawBcCourtsRecord[], options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<BcCourtsRecord[]> {
  const results: BcCourtsRecord[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseBcCourtsRecord(raw, options);
    if (parsed !== null) results.push(parsed);
  }
  return results;
}
