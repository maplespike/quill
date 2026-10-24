// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { QcImmigrationRecord, RawQcImmigrationRecord } from './types.js';

export async function parseQcImmigrationRecord(raw: RawQcImmigrationRecord, options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<QcImmigrationRecord | null> {
  const sourceUrl = raw.source_url ?? '';
  if (!sourceUrl) return null;

  const sourceSystem = options.sourceSystem ?? 'qc-mifi';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    stream: raw.stream,
    nominations_issued: raw.nominations_issued,
    year: raw.year,
    quarter: raw.quarter,
    country_of_origin: raw.country_of_origin,
    region: raw.region,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    recordType: 'qc_immigration',
    stream: raw.stream ?? null,
    nominationsIssued: raw.nominations_issued ?? null,
    year: raw.year ?? null,
    quarter: raw.quarter ?? null,
    countryOfOrigin: raw.country_of_origin ?? null,
    region: raw.region ?? null,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

export async function parseQcImmigrationBatch(rawRecords: RawQcImmigrationRecord[], options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<QcImmigrationRecord[]> {
  const results: QcImmigrationRecord[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseQcImmigrationRecord(raw, options);
    if (parsed !== null) results.push(parsed);
  }
  return results;
}
