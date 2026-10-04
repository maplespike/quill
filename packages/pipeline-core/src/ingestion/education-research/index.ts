/**
 * Education & Research Ingestion — Quill
 *
 * Orchestrates education & research data ingestion across all sources:
 *   1. Tri-Council grants (CIHR, NSERC, SSHRC) — federal research funding
 *   2. Canada Research Chairs (CRC) — Tier 1 & Tier 2 chairs
 *   3. Canada Foundation for Innovation (CFI) — research infrastructure
 *   4. Canada Student Loans (CSL) — default rates, debt, repayment
 *
 * Each function:
 *   - When db is provided: persists parsed records to the database
 *   - When db is null: returns parsed records as structured data in the result
 *
 * All major education data sources have real fetchers
 *   - Digital Research Alliance of Canada (alliancecan.ca)
 *   - Mitacs (mitacs.ca)
 */

import {
  ingestAgencyGrants,
  ingestAllTriCouncilGrants,
} from './tri-council.js';
import { ingestCRC } from './crc.js';
import { ingestCFI } from './cfi.js';
import { ingestStudentLoansPackage, ingestAllStudentLoans } from './student-loans.js';
import { EDU_CKAN_PACKAGE_IDS, EDU_DDL } from './constants.js';
import type { D1Database } from '../committees/db.js';
import type { EduIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for convenience                                        */
/* ------------------------------------------------------------------ */

export { EDU_CKAN_PACKAGE_IDS, EDU_CKAN_QUERIES, EDU_DDL, EDU_SOURCES } from './constants.js';
export type { EduIngestionResult } from './types.js';
export { parseTriCouncilGrant, parseTriCouncilGrants, normalizeDate, parseNumeric } from './parser.js';

/* ------------------------------------------------------------------ */
/*  Individual Ingestion Functions                                     */
/* ------------------------------------------------------------------ */

/**
 * Ingest all Tri-Council grant data (CIHR, NSERC, SSHRC).
 */
export async function ingestTriCouncil(
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<Record<string, EduIngestionResult>> {
  return ingestAllTriCouncilGrants(db, options);
}

/**
 * Ingest Canada Research Chairs data.
 */
export async function ingestResearchChairs(
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<EduIngestionResult> {
  return ingestCRC(db, options);
}

/**
 * Ingest Canada Foundation for Innovation infrastructure data.
 */
export async function ingestCFIData(
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<EduIngestionResult> {
  return ingestCFI(db, options);
}

/**
 * Ingest Canada Student Loans data (default rates + debt).
 */
export async function ingestStudentLoans(
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<Record<string, EduIngestionResult>> {
  return ingestAllStudentLoans(db, options);
}

/* ------------------------------------------------------------------ */
/*  Bulk Ingestion                                                     */
/* ------------------------------------------------------------------ */

/**
 * Run all education & research data ingestion pipelines.
 */
export async function ingestAllEducationResearch(
  db: D1Database | null,
  options: {
    onProgress?: (msg: string) => void;
  } = {},
): Promise<Record<string, Record<string, EduIngestionResult> | EduIngestionResult>> {
  const log = options.onProgress ?? (() => {});

  log('=== Education & Research Data Ingestion ===');

  const results: Record<string, Record<string, EduIngestionResult> | EduIngestionResult> = {};

  // 1. Tri-Council grants (CIHR, NSERC, SSHRC)
  log('[Edu] Ingesting Tri-Council grants...');
  results['tri-council'] = await ingestAllTriCouncilGrants(db, options);

  // 2. Canada Research Chairs
  log('[Edu] Ingesting Canada Research Chairs...');
  results['research-chairs'] = await ingestCRC(db, options);

  // 3. Canada Foundation for Innovation
  log('[Edu] Ingesting CFI infrastructure...');
  results['cfi-infrastructure'] = await ingestCFI(db, options);

  // 4. Canada Student Loans
  log('[Edu] Ingesting Canada Student Loans...');
  results['student-loans'] = await ingestAllStudentLoans(db, options);

  return results;
}

/**
 * Initialize all education & research tables in the database.
 */
export async function initializeEducationTables(
  db: D1Database,
): Promise<void> {
  // Split DDL into individual statements and execute each
  const statements = EDU_DDL
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

  for (const stmt of statements) {
    try {
      await db.exec(stmt + ';');
    } catch (err) {
      console.error(`[Edu] DDL error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
