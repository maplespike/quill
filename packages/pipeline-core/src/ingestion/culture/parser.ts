// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { CultureRecord, CmfProductionData } from './types.js';

/**
 * Build a CultureRecord from raw field values.
 *
 * Each data source provides its own category, subcategory,
 * and identity key for hashing. This ensures deduplication
 * across sources works correctly.
 */
export async function toCultureRecord(
  identityKey: string,
  fields: {
    year: number;
    category: string;
    subcategory?: string;
    value: number;
    amount?: number;
    description: string;
    region?: string;
    program?: string;
    recipient?: string;
    sourceUrl: string;
    sourceName: string;
  },
  ingestedAt?: string,
): Promise<CultureRecord> {
  const id = await computeHash(`culture:${identityKey}`, 'sha256');
  return {
    id,
    year: fields.year,
    category: fields.category,
    subcategory: fields.subcategory,
    value: fields.value,
    amount: fields.amount,
    description: fields.description,
    region: fields.region ?? 'Canada',
    program: fields.program,
    recipient: fields.recipient,
    sourceUrl: fields.sourceUrl,
    sourceName: fields.sourceName,
    ingestedAt: ingestedAt ?? new Date().toISOString(),
  };
}

export async function batchToCultureRecords(
  items: Array<{
    identityKey: string;
    year: number;
    subcategory?: string;
    value: number;
    amount?: number;
    description: string;
    region?: string;
    program?: string;
    recipient?: string;
    sourceUrl: string;
  }>,
  category: string,
  sourceName: string,
  ingestedAt?: string,
): Promise<CultureRecord[]> {
  const now = ingestedAt ?? new Date().toISOString();
  return Promise.all(
    items.map(item =>
      toCultureRecord(item.identityKey, {
        year: item.year,
        category,
        subcategory: item.subcategory,
        value: item.value,
        amount: item.amount,
        description: item.description,
        region: item.region,
        program: item.program,
        recipient: item.recipient,
        sourceUrl: item.sourceUrl,
        sourceName,
      }, now),
    ),
  );
}

export function parseCmfEntries(
  entries: unknown[],
  sourceUrl: string,
  now: string,
): Array<{ identityKey: string; year: number; subcategory?: string; value: number; amount?: number; description: string; region?: string; program?: string; recipient?: string; sourceUrl: string }> {
  return (entries as Array<Record<string, unknown>>).slice(0, 100).map(entry => ({
    identityKey: `cmf:${entry.id ?? entry.projectId ?? Math.random()}`,
    year: (entry.year as number) ?? new Date().getFullYear(),
    subcategory: (entry.category as string) ?? 'Production Envelope',
    value: 1,
    amount: entry.amount as number | undefined,
    description: (entry.title as string) ?? (entry.project as string) ?? `CMF ${entry.category ?? 'funding'} envelope`,
    region: (entry.province as string) ?? 'Canada',
    program: (entry.program as string) ?? (entry.stream as string) ?? '',
    recipient: (entry.company as string) ?? (entry.recipient as string) ?? '',
    sourceUrl: (entry.url as string) ?? sourceUrl,
  }));
}
