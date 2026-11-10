// SPDX-License-Identifier: AGPL-3.0-only
import { computeHash } from '../../verification/hashing.js';

export async function parseIrccRecord(raw: Record<string, unknown>, programType: string): Promise<Record<string, unknown>> {
  try {
    const id = await computeHash(`ircc:${programType}:${JSON.stringify(raw)}`, 'sha256');
    return { id, programType, ...raw };
  } catch (err) {
    console.warn(`[IRCC Parser] Skipping: ${(err as Error).message}`);
    return {};
  }
}

export async function parseIrccRecords(rawRecords: Record<string, unknown>[], programType: string): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const raw of rawRecords) {
    try {
      const id = await computeHash(`ircc:${programType}:${JSON.stringify(raw)}`, 'sha256');
      if (seen.has(id)) continue;
      seen.add(id);
      results.push({ id, programType, ...raw });
    } catch (err) {
      console.warn(`[IRCC Parser] Skipping: ${(err as Error).message}`);
    }
  }
  return results;
}
