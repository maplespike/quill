// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { BcImmigrationRecord, RawBcImmigrationRecord } from './types.js';

export async function parseBcImmigrationRecord(raw: RawBcImmigrationRecord, options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<BcImmigrationRecord | null> {
  const sourceUrl = raw.source_url ?? '';
  if (!sourceUrl) return null;

  const sourceSystem = options.sourceSystem ?? 'bc-bcpnp';
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
    recordType: 'bcpnp',
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

export async function parseBcImmigrationBatch(rawRecords: RawBcImmigrationRecord[], options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<BcImmigrationRecord[]> {
  const results: BcImmigrationRecord[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseBcImmigrationRecord(raw, options);
    if (parsed !== null) results.push(parsed);
  }
  return results;
}
