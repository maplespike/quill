// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { OnCourtsRecord, RawOnCourtsRecord } from './types.js';

export async function parseOnCourtsRecord(raw: RawOnCourtsRecord, options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<OnCourtsRecord | null> {
  const sourceUrl = raw.source_url ?? '';
  if (!sourceUrl) return null;

  const sourceSystem = options.sourceSystem ?? 'on-courts';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    court_type: raw.court_type,
    case_number: raw.case_number,
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
    recordType: 'on_court',
    courtType: raw.court_type ?? null,
    caseNumber: raw.case_number ?? null,
    filingDate: raw.filing_date ?? null,
    caseType: raw.case_type ?? null,
    location: raw.location ?? null,
    status: raw.status ?? null,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

export async function parseOnCourtsBatch(rawRecords: RawOnCourtsRecord[], options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<OnCourtsRecord[]> {
  const results: OnCourtsRecord[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseOnCourtsRecord(raw, options);
    if (parsed !== null) results.push(parsed);
  }
  return results;
}
