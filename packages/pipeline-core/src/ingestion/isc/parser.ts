// SPDX-License-Identifier: AGPL-3.0-only
import { computeHash } from '../../verification/hashing.js';

export async function parseIscRecord(raw: Record<string, unknown>, recordType: string): Promise<Record<string, unknown>> {
  try {
    const id = await computeHash(`isc:${recordType}:${JSON.stringify(raw)}`, 'sha256');
    return { id, recordType, ...raw };
  } catch (err) {
    console.warn(`[ISC Parser] Skipping: ${(err as Error).message}`);
    return {};
  }
}

export async function parseIscRecords(rawRecords: Record<string, unknown>[], recordType: string): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const raw of rawRecords) {
    try {
      const id = await computeHash(`isc:${recordType}:${JSON.stringify(raw)}`, 'sha256');
      if (seen.has(id)) continue;
      seen.add(id);
      results.push({ id, recordType, ...raw });
    } catch (err) {
      console.warn(`[ISC Parser] Skipping: ${(err as Error).message}`);
    }
  }
  return results;
}
