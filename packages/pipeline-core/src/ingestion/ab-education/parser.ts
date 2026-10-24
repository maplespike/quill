// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { AbEducationRecord, RawAbEducationRecord } from './types.js';

export async function parseAbEducationRecord(raw: RawAbEducationRecord, options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<AbEducationRecord | null> {
  const sourceUrl = raw.source_url ?? '';
  if (!sourceUrl) return null;

  const sourceSystem = options.sourceSystem ?? 'ab-education';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    category: raw.category,
    school_authority: raw.school_authority,
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
    recordType: 'ab_education',
    category: raw.category ?? null,
    schoolAuthority: raw.school_authority ?? null,
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

export async function parseAbEducationBatch(rawRecords: RawAbEducationRecord[], options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<AbEducationRecord[]> {
  const results: AbEducationRecord[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseAbEducationRecord(raw, options);
    if (parsed !== null) results.push(parsed);
  }
  return results;
}
