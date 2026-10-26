// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { OnEducationRecord, RawOnEducationRecord } from './types.js';

export async function parseOnEducationRecord(raw: RawOnEducationRecord, options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<OnEducationRecord | null> {
  const sourceUrl = raw.source_url ?? '';
  if (!sourceUrl) return null;

  const sourceSystem = options.sourceSystem ?? 'on-education';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    category: raw.category,
    school_board: raw.school_board,
    school_name: raw.school_name,
    academic_year: raw.academic_year,
    grade: raw.grade,
    subject: raw.subject,
    result: raw.result,
    student_count: raw.student_count,
    funding_amount: raw.funding_amount,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    recordType: 'on_education',
    category: raw.category ?? null,
    schoolBoard: raw.school_board ?? null,
    schoolName: raw.school_name ?? null,
    academicYear: raw.academic_year ?? null,
    grade: raw.grade ?? null,
    subject: raw.subject ?? null,
    result: raw.result ?? null,
    studentCount: raw.student_count ?? null,
    fundingAmount: raw.funding_amount ?? null,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

export async function parseOnEducationBatch(rawRecords: RawOnEducationRecord[], options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<OnEducationRecord[]> {
  const results: OnEducationRecord[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseOnEducationRecord(raw, options);
    if (parsed !== null) results.push(parsed);
  }
  return results;
}
