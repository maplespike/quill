// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { QcCourtsRecord, RawQcCourtsRecord } from './types.js';

export async function parseQcCourtsRecord(raw: RawQcCourtsRecord, options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<QcCourtsRecord | null> {
  const sourceUrl = raw.source_url ?? '';
  if (!sourceUrl) return null;

  const sourceSystem = options.sourceSystem ?? 'qc-courts';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    court_type: raw.court_type,
    file_number: raw.file_number,
    filing_date: raw.filing_date,
    case_type: raw.case_type,
    district: raw.district,
    status: raw.status,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    recordType: 'qc_court',
    courtType: raw.court_type ?? null,
    fileNumber: raw.file_number ?? null,
    filingDate: raw.filing_date ?? null,
    caseType: raw.case_type ?? null,
    district: raw.district ?? null,
    status: raw.status ?? null,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

export async function parseQcCourtsBatch(rawRecords: RawQcCourtsRecord[], options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<QcCourtsRecord[]> {
  const results: QcCourtsRecord[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseQcCourtsRecord(raw, options);
    if (parsed !== null) results.push(parsed);
  }
  return results;
}
