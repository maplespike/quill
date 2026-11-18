// SPDX-License-Identifier: AGPL-3.0-only
import { computeHash } from '../../verification/hashing.js';
import type { ProvincialDataset } from './types.js';

export function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr.substring(0, 10) : d.toISOString().substring(0, 10);
}

export function parseNumeric(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).replace(/[,$€£\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export async function parseProvincialDataset(raw: Record<string, unknown>): Promise<ProvincialDataset | null> {
  try {
    const id = await computeHash(`provincial:${JSON.stringify(raw)}`, 'sha256');
    return { id, ...raw } as unknown as ProvincialDataset;
  } catch (err) {
    console.warn(`[provincial Parser] Skipping: ${(err as Error).message}`);
    return null;
  }
}

export async function parseProvincialDatasets(rawRecords: Record<string, unknown>[]): Promise<ProvincialDataset[]> {
  const results: ProvincialDataset[] = [];
  const seen = new Set<string>();
  for (const raw of rawRecords) {
    try {
      const id = await computeHash(`provincial:${JSON.stringify(raw)}`, 'sha256');
      if (seen.has(id)) continue;
      seen.add(id);
      results.push({ id, ...raw } as unknown as ProvincialDataset);
    } catch (err) {
      console.warn(`[provincial Parser] Skipping: ${(err as Error).message}`);
    }
  }
  return results;
}
