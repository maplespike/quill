// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ISC Ingestion Module — Quill
 *
 * Indigenous Services Canada community safety programs.
 */

import { fetchIscCsv } from './fetcher.js';
import { parseSafetyPrograms } from './parser.js';
import { ISC_PACKAGES } from './constants.js';
import type { SafetyProgram, IscIngestionResult } from './types.js';

export async function ingestCommunitySafety(
  options: { limit?: number } = {},
): Promise<IscIngestionResult & { records: SafetyProgram[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: SafetyProgram[] = [];

  try {
    const csv = await fetchIscCsv(ISC_PACKAGES.COMMUNITY_SAFETY);
    records = await parseSafetyPrograms(csv);
    recordsFound = records.length;
    recordsIngested = records.length;

    if (options.limit) {
      records = records.slice(0, options.limit);
      recordsIngested = records.length;
    }
  } catch (error) {
    errors.push((error as Error).message);
  }

  return {
    dataset: 'community-safety',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchSafetyByCommunity(
  community: string,
  options: { limit?: number } = {},
): Promise<SafetyProgram[]> {
  const result = await ingestCommunitySafety(options);
  const normalized = community.toLowerCase();
  return result.records.filter(r => r.community.toLowerCase().includes(normalized));
}

export async function searchSafetyByType(
  type: string,
  options: { limit?: number } = {},
): Promise<SafetyProgram[]> {
  const result = await ingestCommunitySafety(options);
  return result.records.filter(r => r.type === type);
}