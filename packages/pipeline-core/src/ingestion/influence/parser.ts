// SPDX-License-Identifier: AGPL-3.0-only
import { computeHash } from '../../verification/hashing.js';
import type { InfluenceActor } from './types.js';

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

export async function parseInfluenceActor(raw: Record<string, unknown>): Promise<InfluenceActor | null> {
  try {
    const id = await computeHash(`influence:${JSON.stringify(raw)}`, 'sha256');
    return { id, ...raw } as unknown as InfluenceActor;
  } catch (err) {
    console.warn(`[influence Parser] Skipping: ${(err as Error).message}`);
    return null;
  }
}

export async function parseInfluenceActors(rawRecords: Record<string, unknown>[]): Promise<InfluenceActor[]> {
  const results: InfluenceActor[] = [];
  const seen = new Set<string>();
  for (const raw of rawRecords) {
    try {
      const id = await computeHash(`influence:${JSON.stringify(raw)}`, 'sha256');
      if (seen.has(id)) continue;
      seen.add(id);
      results.push({ id, ...raw } as unknown as InfluenceActor);
    } catch (err) {
      console.warn(`[influence Parser] Skipping: ${(err as Error).message}`);
    }
  }
  return results;
}
