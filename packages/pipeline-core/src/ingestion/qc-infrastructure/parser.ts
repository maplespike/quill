// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { QcInfrastructureRecord, RawQcInfrastructureRecord } from './types.js';

export async function parseQcInfrastructureRecord(raw: RawQcInfrastructureRecord, options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<QcInfrastructureRecord | null> {
  const sourceUrl = raw.source_url ?? '';
  if (!sourceUrl) return null;
  const sourceSystem = options.sourceSystem ?? 'qc-infrastructure';
  const now = options.ingestedAt ?? new Date().toISOString();
  const contentForHash = JSON.stringify({
    category: raw.category,
    subcategory: raw.subcategory,
    value: raw.value,
    unit: raw.unit,
    period: raw.period,
    fiscal_year: raw.fiscal_year,
    region: raw.region,
    status: raw.status,
    description: raw.description,
    sourceUrl, sourceSystem,
  });
  const id = await computeHash(contentForHash, 'sha256');
  const parsedValue = typeof raw.value === 'number' ? raw.value : typeof raw.value === 'string' ? parseFloat(raw.value) : null;
  return {
    id, recordType: 'qc_infrastructure',
    category: raw.category ?? null,
    subcategory: raw.subcategory ?? null,
    value: isNaN(parsedValue as number) ? null : (parsedValue as number | null),
    unit: raw.unit ?? null,
    period: raw.period ?? null,
    fiscalYear: raw.fiscal_year ?? null,
    region: raw.region ?? null,
    status: raw.status ?? null,
    description: raw.description ?? null,
    sourceUrl, sourceSystem, ingestedAt: now,
  };
}

export async function parseQcInfrastructureBatch(rawRecords: RawQcInfrastructureRecord[], options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<QcInfrastructureRecord[]> {
  const results: QcInfrastructureRecord[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseQcInfrastructureRecord(raw, options);
    if (parsed !== null) results.push(parsed);
  }
  return results;
}
