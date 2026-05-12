/**
 * Corporate Ingestion — Frostbite Data Pipeline
 *
 * Orchestrates corporate/business data ingestion across all sources:
 *   1. Lobbying Registry — who's influencing government
 *   2. Procurement — who's getting taxpayer contracts
 *   3. Executive Statements — what CEOs are saying publicly
 *   4. Committee cross-reference — connect executive testimony to lobbying
 *
 * Designed to run as a cron job alongside the committee pipeline.
 * All data sources are public-domain and freely accessible.
 */

import { fetchRegistrationsCsv, searchLobbying, fetchMonthlyCommunicationReports } from './lobbying.js';
import { fetchTendersRss, fetchProactiveDisclosureContracts, isSoleSource } from './procurement.js';
import { fetchCompanyPressReleases, extractExecutiveStatements } from './statements.js';
import { TRACKED_EXECUTIVES } from './constants.js';
import type { D1Database } from '../committees/db.js';
import type { CorporateIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  Lobbying Ingestion                                                 */
/* ------------------------------------------------------------------ */

/**
 * Ingest lobbying data into the database.
 * Starts with the monthly CSV reports for recent activity.
 */
export async function ingestLobbying(
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<CorporateIngestionResult> {
  const startTime = Date.now();
  const result: CorporateIngestionResult = {
    source: 'lobbying-registry',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    // Step 1: Get monthly communication reports
    const reports = await fetchMonthlyCommunicationReports();
    result.recordsFound = reports.length;
    log(`[Lobbying] Found ${reports.length} monthly reports`);

    // Step 2: For now, log what's available
    for (const report of reports.slice(0, options.limit ?? 5)) {
      log(`[Lobbying] Report: ${report.year}-${report.month} → ${report.csvUrl}`);
    }

    result.recordsIngested = reports.length;
    log(`[Lobbying] Done — ${reports.length} reports available`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[Lobbying] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Procurement Ingestion                                              */
/* ------------------------------------------------------------------ */

/**
 * Ingest government procurement data.
 */
export async function ingestProcurement(
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<CorporateIngestionResult> {
  const startTime = Date.now();
  const result: CorporateIngestionResult = {
    source: 'procurement',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    // Fetch recent tenders from CanadaBuys RSS
    log(`[Procurement] Fetching CanadaBuys tenders...`);
    const tenders = await fetchTendersRss();
    result.recordsFound = tenders.length;
    log(`[Procurement] Found ${tenders.length} tender notices`);

    // Check for sole-source contracts
    const soleSource = tenders.filter(t => isSoleSource(t.description, t.procurementMethod));
    log(`[Procurement] ${soleSource.length} sole-source indicators`);

    // Fetch proactive disclosure
    log(`[Procurement] Checking proactive disclosure...`);
    const disclosure = await fetchProactiveDisclosureContracts();
    log(`[Procurement] ${disclosure.total} proactive disclosure contracts in index`);

    result.recordsIngested = tenders.length;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[Procurement] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Executive Statements Ingestion                                     */
/* ------------------------------------------------------------------ */

/**
 * Collect recent public statements from tracked high-impact executives.
 */
export async function ingestExecutiveStatements(
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<CorporateIngestionResult> {
  const startTime = Date.now();
  const result: CorporateIngestionResult = {
    source: 'executive-statements',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    // Fetch press releases for each tracked organization
    const orgs = Array.from(new Set(TRACKED_EXECUTIVES.map(e => e.organization)));
    log(`[ExecStatements] Tracking ${TRACKED_EXECUTIVES.length} execs across ${orgs.length} orgs`);

    let totalStatements = 0;

    for (const org of orgs) {
      const releases = await fetchCompanyPressReleases(org);
      const statements = extractExecutiveStatements(releases);
      totalStatements += statements.length;

      for (const stmt of statements.slice(0, options.limit ?? 10)) {
        log(`[ExecStatements] ${stmt.executiveName} (${stmt.organization}): "${stmt.title.substring(0, 80)}"`);
      }
    }

    result.recordsFound = totalStatements;
    result.recordsIngested = totalStatements;
    log(`[ExecStatements] Found ${totalStatements} executive statements`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[ExecStatements] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Bulk Ingestion                                                     */
/* ------------------------------------------------------------------ */

/**
 * Run all corporate data ingestion pipelines.
 */
export async function ingestAllCorporate(
  db: D1Database | null,
  options: {
    onProgress?: (msg: string) => void;
  } = {},
): Promise<Record<string, CorporateIngestionResult>> {
  const log = options.onProgress ?? (() => {});

  log('=== Corporate Data Ingestion ===');

  const [lobbying, procurement, statements] = await Promise.all([
    ingestLobbying(db, options),
    ingestProcurement(db, options),
    ingestExecutiveStatements(db, options),
  ]);

  const results: Record<string, CorporateIngestionResult> = {
    'lobbying': lobbying,
    'procurement': procurement,
    'executive-statements': statements,
  };

  log(`\n=== Corporate Summary ===`);
  log(`Lobbying: ${lobbying.recordsFound} reports`);
  log(`Procurement: ${procurement.recordsFound} tenders`);
  log(`Exec Statements: ${statements.recordsFound} found`);
  
  const totalErrors = lobbying.errors.length + procurement.errors.length + statements.errors.length;
  if (totalErrors > 0) {
    log(`Errors: ${totalErrors}`);
  }

  return results;
}
