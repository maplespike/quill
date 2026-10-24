// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { AbImmigrationRecord, RawAbImmigrationRecord } from './types.js';

export async function parseAbImmigrationRecord(raw: RawAbImmigrationRecord, options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<AbImmigrationRecord | null> {
  const sourceUrl = raw.source_url ?? '';
  if (!sourceUrl) return null;

  const sourceSystem = options.sourceSystem ?? 'ab-aaip';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    stream: raw.stream,
    nominations_issued: raw.nominations_issued,
    year: raw.year,
    quarter: raw.quarter,
    occupation: raw.occupation,
    industry: raw.industry,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    recordType: 'aaip',
    stream: raw.stream ?? null,
    nominationsIssued: raw.nominations_issued ?? null,
    year: raw.year ?? null,
    quarter: raw.quarter ?? null,
    occupation: raw.occupation ?? null,
    industry: raw.industry ?? null,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

export async function parseAbImmigrationBatch(rawRecords: RawAbImmigrationRecord[], options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<AbImmigrationRecord[]> {
  const results: AbImmigrationRecord[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseAbImmigrationRecord(raw, options);
    if (parsed !== null) results.push(parsed);
  }
  return results;
}
