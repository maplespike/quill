// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Provincial Orgs Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for provincial oversight body data
 * across all 13 Canadian provinces and territories.
 *
 * Covers bodies such as:
 *   - Auditors General
 *   - Ombudsman offices
 *   - Human rights tribunals
 *   - Campaign finance / elections oversight
 *   - Ethics commissioners
 *   - Energy and utilities regulators
 *   - Sunshine list / salary disclosure bodies
 *
 * Cross-referencing opportunities:
 *   - Federal oversight: compare provincial AG reports with OAG audits
 *   - Corporate registry: match provincial procurement / contracting data
 *   - Lobbying: ethics commissioner lobbying registries vs federal registry
 *   - Influence tracking: campaign donations routed through elections bodies
 *   - NGO funding: provincial grant recipients in AG reports
 */

import {
  fetchProvincialOrgReport,
  fetchAllProvincialOrgReports,
  searchProvincialOrgRecords,
} from './fetcher.js';
import { PROVINCIAL_ORGS } from './constants.js';
import type { ProvincialOrgRecord, ProvincialOrgIngestionResult } from './types.js';

/**
 * Ingest records from all enabled provincial oversight bodies.
 */
export async function ingestAllProvincialOrgs(): Promise<ProvincialOrgIngestionResult> {
  return fetchAllProvincialOrgReports();
}

/**
 * Ingest records from all bodies in a specific province.
 */
export async function ingestProvinceOrgs(province: string): Promise<ProvincialOrgRecord[]> {
  const codes = PROVINCIAL_ORGS
    .filter(o => o.province === province && o.enabled)
    .map(o => o.code);

  const results = await Promise.allSettled(
    codes.map(code => fetchProvincialOrgReport(code))
  );

  const allRecords: ProvincialOrgRecord[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allRecords.push(...result.value);
    }
  }

  // Deduplicate by hash
  const seen = new Set<string>();
  return allRecords.filter(r => {
    if (seen.has(r.hash)) return false;
    seen.add(r.hash);
    return true;
  });
}

/**
 * Search across an array of provincial org records.
 */
export function searchProvincialOrg(records: ProvincialOrgRecord[], query: string): ProvincialOrgRecord[] {
  return searchProvincialOrgRecords(records, query);
}

export { PROVINCIAL_ORGS } from './constants.js';
export type { ProvincialOrgRecord, ProvincialOrgIngestionResult } from './types.js';
export { parseProvincialOrgRecord, parseProvincialOrgRecords, normalizeDate, parseNumeric } from './parser.js';
