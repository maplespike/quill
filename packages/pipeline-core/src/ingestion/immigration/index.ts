// SPDX-License-Identifier: AGPL-3.0-only
/**
export { parsePermanentResidentAdmission, parsePermanentResidentAdmissions } from './parser.js';
 * Immigration Ingestion — Quill
 *
 * Orchestrates immigration, refugee, and border data ingestion
 * across IRCC, IRB, and CBSA sources.
 *
 * Sources:
 *   - IRCC open data CSV (permanent residents, study permits, work permits)
 *   - IRB RPD decisions (quarterly CSV)
 *   - CBSA AMPS penalties (CSV)
 *
 * Designed to run as a cron job alongside other pipeline modules.
 */

import { IMMIGRATION_SOURCE_NAMES } from './constants.js';
import {
  fetchPermanentResidentsByProvince,
  fetchPermanentResidentsByCitizenship,
  fetchStudyPermitHolders,
  fetchWorkPermitImp,
  fetchWorkPermitTfwp,
} from './ircc.js';
import { fetchRecentRpdDecisions, computeRpdStats } from './irb.js';
import { fetchAmpsStats } from './cbsa.js';
import type { ImmigrationIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  IRCC Permanent Residents Ingestion                                 */
/* ------------------------------------------------------------------ */

export async function ingestPermanentResidents(
  options: {
    onProgress?: (msg: string) => void;
    limit?: number;
  } = {},
): Promise<ImmigrationIngestionResult> {
  const startTime = Date.now();
  const result: ImmigrationIngestionResult = {
    source: IMMIGRATION_SOURCE_NAMES.PERMANENT_RESIDENTS,
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };
  const log = options.onProgress ?? (() => {});

  try {
    const [byProvince, byCitizen] = await Promise.all([
      fetchPermanentResidentsByProvince(options.limit),
      fetchPermanentResidentsByCitizenship(options.limit),
    ]);

    result.recordsFound = byProvince.length + byCitizen.length;
    result.recordsIngested = result.recordsFound;

    // Aggregate stats by category for reporting
    const byCategory = new Map<string, number>();
    for (const r of byProvince) {
      byCategory.set(r.immigrationCategory, (byCategory.get(r.immigrationCategory) ?? 0) + r.count);
    }

    log(`[Immigration] Permanent Residents: ${result.recordsFound} records`);
    for (const [cat, count] of Array.from(byCategory.entries())) {
      log(`[Immigration]   ${cat}: ${count.toLocaleString()} admissions`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[Immigration] ERROR (permanent residents): ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  IRCC Study & Work Permits Ingestion                                */
/* ------------------------------------------------------------------ */

export async function ingestTempResidents(
  options: {
    onProgress?: (msg: string) => void;
    limit?: number;
  } = {},
): Promise<ImmigrationIngestionResult> {
  const startTime = Date.now();
  const result: ImmigrationIngestionResult = {
    source: 'ircc-temp-residents',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };
  const log = options.onProgress ?? (() => {});

  try {
    const [study, workImp, workTfwp] = await Promise.all([
      fetchStudyPermitHolders(options.limit),
      fetchWorkPermitImp(options.limit),
      fetchWorkPermitTfwp(options.limit),
    ]);

    result.recordsFound = study.length + workImp.length + workTfwp.length;
    result.recordsIngested = result.recordsFound;

    const totalStudy = study.reduce((s, r) => s + r.count, 0);
    const totalWork = [...workImp, ...workTfwp].reduce((s, r) => s + r.count, 0);

    log(`[Immigration] Study Permits: ${study.length} records (${totalStudy.toLocaleString()} holders)`);
    log(`[Immigration] Work Permits (IMP): ${workImp.length} records`);
    log(`[Immigration] Work Permits (TFWP): ${workTfwp.length} records`);
    log(`[Immigration] Total Work: ${totalWork.toLocaleString()} permit holders`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[Immigration] ERROR (temp residents): ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  IRB Refugee Decisions Ingestion                                    */
/* ------------------------------------------------------------------ */

export async function ingestRpdDecisions(
  options: {
    onProgress?: (msg: string) => void;
    limit?: number;
  } = {},
): Promise<ImmigrationIngestionResult> {
  const startTime = Date.now();
  const result: ImmigrationIngestionResult = {
    source: IMMIGRATION_SOURCE_NAMES.RPD_DECISIONS,
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };
  const log = options.onProgress ?? (() => {});

  try {
    const decisions = await fetchRecentRpdDecisions(
      new Date().getFullYear(),
      Math.ceil((new Date().getMonth() + 1) / 3),
      options.limit,
    );

    result.recordsFound = decisions.length;
    result.recordsIngested = decisions.length;

    const stats = computeRpdStats(decisions);
    log(`[IRB] RPD Decisions: ${result.recordsFound} records`);
    log(`[IRB]   Accepted: ${stats.accepted} (${(stats.acceptanceRate * 100).toFixed(1)}%)`);
    log(`[IRB]   Rejected: ${stats.rejected}`);
    log(`[IRB]   Abandoned: ${stats.abandoned}`);
    log(`[IRB]   Withdrawn: ${stats.withdrawn}`);

    // Top countries by volume
    const topCountries = Object.entries(stats.byCountry)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
    for (const [country, data] of topCountries) {
      const rate = data.total > 0 ? ((data.accepted / data.total) * 100).toFixed(1) : 'N/A';
      log(`[IRB]   ${country}: ${data.total} decisions, ${rate}% acceptance`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[IRB] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  CBSA Enforcement Ingestion                                         */
/* ------------------------------------------------------------------ */

export async function ingestCbsaEnforcement(
  options: {
    onProgress?: (msg: string) => void;
    limit?: number;
  } = {},
): Promise<ImmigrationIngestionResult> {
  const startTime = Date.now();
  const result: ImmigrationIngestionResult = {
    source: IMMIGRATION_SOURCE_NAMES.CBSA_AMPS,
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };
  const log = options.onProgress ?? (() => {});

  try {
    const amps = await fetchAmpsStats(options.limit);

    result.recordsFound = amps.length;
    result.recordsIngested = amps.length;

    const totalPenalties = amps.reduce((s, p) => s + p.count, 0);
    const totalAmount = amps.reduce((s, p) => s + p.penaltyAmount, 0);

    log(`[CBSA] AMPS: ${result.recordsFound} record types`);
    log(`[CBSA]   Total penalties: ${totalPenalties.toLocaleString()}`);
    log(`[CBSA]   Total value: $${totalAmount.toLocaleString()}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[CBSA] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Master Ingestion                                                   */
/* ------------------------------------------------------------------ */

/**
 * Run all immigration ingestion pipelines in parallel.
 * This is the primary entry point for cron job scheduling.
 */
export async function ingestAllImmigration(
  options: {
    onProgress?: (msg: string) => void;
    limit?: number;
  } = {},
): Promise<Record<string, ImmigrationIngestionResult>> {
  const log = options.onProgress ?? (() => {});
  log('[Immigration] Starting all immigration ingestion pipelines...');

  const [permanentResidents, tempResidents, rpdDecisions, cbsa] = await Promise.all([
    ingestPermanentResidents(options),
    ingestTempResidents(options),
    ingestRpdDecisions(options),
    ingestCbsaEnforcement(options),
  ]);

  const total = permanentResidents.recordsIngested + tempResidents.recordsIngested
    + rpdDecisions.recordsIngested + cbsa.recordsIngested;
  log(`[Immigration] Done — ${total} total records across 4 pipelines`);

  return {
    permanentResidents,
    tempResidents,
    rpdDecisions,
    cbsa,
  };
}

/* ------------------------------------------------------------------ */
/*  Cross-Reference: Immigration ↔ Lobbying                           */
/* ------------------------------------------------------------------ */

/**
 * Generate cross-reference links between IRCC departments
 * and lobbying registry data (for the influence module).
 */
export function generateImmigrationLobbyingLinks(): {
  department: string;
  expectedLobbyingSubjects: string[];
  oversightCommittee: string;
}[] {
  return [
    {
      department: 'Immigration, Refugees and Citizenship Canada (IRCC)',
      expectedLobbyingSubjects: [
        'Immigration',
        'Employment and Training',
        'Education',
        'Health',
        'Housing',
        'Justice and Law Enforcement',
      ],
      oversightCommittee: 'CIMM — Standing Committee on Citizenship and Immigration',
    },
    {
      department: 'Canada Border Services Agency (CBSA)',
      expectedLobbyingSubjects: [
        'International Trade',
        'Justice and Law Enforcement',
        'Transportation',
        'Customs and Tariffs',
      ],
      oversightCommittee: 'SECU — Standing Committee on Public Safety and National Security',
    },
    {
      department: 'Immigration and Refugee Board (IRB)',
      expectedLobbyingSubjects: [
        'Justice and Law Enforcement',
        'Immigration',
        'Human Rights',
      ],
      oversightCommittee: 'CIMM — Standing Committee on Citizenship and Immigration',
    },
  ];
}
