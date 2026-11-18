// SPDX-License-Identifier: AGPL-3.0-only
import { fetchAllRegional, searchRegional } from './fetcher.js';
import { REGIONAL_AUTHORITIES, REGIONAL_AUTHORITY_MAP } from './constants.js';
import type { RegionalRecord, RegionalIngestionResult, RegionalAuthorityCode, RegionalPortalType, RegionalAuthorityConfig } from './types.js';

export async function ingestAllRegional(): Promise<RegionalIngestionResult> {
  return fetchAllRegional();
}

export function searchRegionalAuthorities(records: RegionalRecord[], query: string, authority?: string): RegionalRecord[] {
  return searchRegional(records, query, authority);
}

export { REGIONAL_AUTHORITIES, REGIONAL_AUTHORITY_MAP };
export type { RegionalRecord, RegionalIngestionResult, RegionalAuthorityCode, RegionalPortalType, RegionalAuthorityConfig };
export { parseRegionalRecord, parseRegionalRecords, normalizeDate, parseNumeric } from './parser.js';
