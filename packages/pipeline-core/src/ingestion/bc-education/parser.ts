// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { BcEducationRecord, RawBcEducationRecord } from './types.js';

export async function parseBcEducationRecord(raw: RawBcEducationRecord, options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<BcEducationRecord | null> {
  const sourceUrl = raw.source_url ?? '';
  if (!sourceUrl) return null;

  const sourceSystem = options.sourceSystem ?? 'bc-education';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    category: raw.category,
    school_district: raw.school_district,
    school_name: raw.school_name,
    academic_year: raw.academic_year,
    grade: raw.grade,
    subject: raw.subject,
    result: raw.result,
    student_count: raw.student_count,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    recordType: 'bc_education',
    category: raw.category ?? null,
    schoolDistrict: raw.school_district ?? null,
    schoolName: raw.school_name ?? null,
    academicYear: raw.academic_year ?? null,
    grade: raw.grade ?? null,
    subject: raw.subject ?? null,
    result: raw.result ?? null,
    studentCount: raw.student_count ?? null,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

export async function parseBcEducationBatch(rawRecords: RawBcEducationRecord[], options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<BcEducationRecord[]> {
  const results: BcEducationRecord[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseBcEducationRecord(raw, options);
    if (parsed !== null) results.push(parsed);
  }
  return results;
}
