// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { OnEconomicRecord, RawOnEconomicRecord } from './types.js';

export async function parseOnEconomicRecord(raw: RawOnEconomicRecord, options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<OnEconomicRecord | null> {
  const sourceUrl = raw.source_url ?? '';
  if (!sourceUrl) return null;
  const sourceSystem = options.sourceSystem ?? 'on-economic';
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
    id, recordType: 'on_economic',
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

export async function parseOnEconomicBatch(rawRecords: RawOnEconomicRecord[], options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<OnEconomicRecord[]> {
  const results: OnEconomicRecord[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseOnEconomicRecord(raw, options);
    if (parsed !== null) results.push(parsed);
  }
  return results;
}
