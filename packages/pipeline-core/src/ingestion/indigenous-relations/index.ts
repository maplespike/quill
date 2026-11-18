// SPDX-License-Identifier: AGPL-3.0-only
/**
export { parseLandClaim, parseLandClaims } from './parser.js';
 * Quill — Indigenous Relations Data Ingestion Orchestration
 *
 * Coordinates CIRNAC land claims, ISC community spending, First Nations
 * financial transparency, TRC Calls to Action, and cross-referencing
 * with lobbying/influence data.
 *
 * Each ingest* function wraps the corresponding fetcher with timing,
 * error handling, and optional D1 persistence.
 *
 * Designed to run as a cron job.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  INDIGENOUS_SOURCE_NAMES,
  CIRNAC_DATASETS,
  INDIGENOUS_SOURCES,
  TRACKED_COMMUNITIES,
  IndigenousFetchError,
  DEFAULT_MAX_RECORDS,
} from './constants.js';
import { fetchLandClaims, fetchSelfGovernmentAgreements } from './cirnac.js';
import {
  fetchIscHealthSpending,
  fetchIscEducationSpending,
  fetchIscInfrastructureSpending,
} from './isc.js';
import { fetchFnTransparencyRecords } from './fn-transparency.js';
import { fetchAllTrcCalls } from './trc.js';
import type {
  LandClaim,
  IscCommunitySpending,
  FnTransparencyRecord,
  TrcCallToAction,
  SelfGovernmentAgreement,
  IndigenousIngestionResult,
  D1Database,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                              */
/* ------------------------------------------------------------------ */

/**
 * Run a fetcher with timing and optional D1 persistence.
 */
async function runPipeline<T>(
  sourceName: string,
  fetcher: () => Promise<T[]>,
  persistFn?: (records: T[]) => Promise<number>,
): Promise<IndigenousIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;

  try {
    const records = await fetcher();
    recordsFound = records.length;

    if (persistFn && records.length > 0) {
      try {
        recordsIngested = await persistFn(records);
      } catch (persistErr) {
        const msg = persistErr instanceof Error ? persistErr.message : String(persistErr);
        errors.push(`persist: ${msg}`);
      }
    } else {
      recordsIngested = records.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
  }

  return {
    source: sourceName,
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - start,
  };
}

/* ------------------------------------------------------------------ */
/*  D1 Persistence                                                      */
/* ------------------------------------------------------------------ */

async function persistLandClaims(
  db: D1Database,
  claims: LandClaim[],
): Promise<number> {
  let count = 0;
  for (const c of claims) {
    const stmt = db
      .prepare(
        `INSERT OR REPLACE INTO indigenous_land_claims
         (id, claim_type, claimant, province_territory, description, status,
          submission_date, settlement_date, settlement_amount_cad, duration_years,
          negotiation_stage, ckan_dataset_id, source_url, ingested_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        c.id, c.claimType, c.claimant, c.provinceTerritory, c.description,
        c.status, c.submissionDate, c.settlementDate, c.settlementAmountCad,
        c.durationYears, c.negotiationStage, c.ckanDatasetId, c.sourceUrl,
        c.ingestedAt,
      );
    await stmt.run();
    count++;
  }
  return count;
}

async function persistIscPrograms(
  db: D1Database,
  records: IscCommunitySpending[],
): Promise<number> {
  let count = 0;
  for (const r of records) {
    const stmt = db
      .prepare(
        `INSERT OR REPLACE INTO indigenous_isc_programs
         (id, fiscal_year, community_name, province_territory, spending_category,
          program_name, allocated_amount, spent_amount, beneficiaries,
          source_url, ingested_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        r.id, r.fiscalYear, r.communityName, r.provinceTerritory,
        r.spendingCategory, r.programName, r.allocatedAmount, r.spentAmount,
        r.beneficiaries, r.sourceUrl, r.ingestedAt,
      );
    await stmt.run();
    count++;
  }
  return count;
}

async function persistFnTransparency(
  db: D1Database,
  records: FnTransparencyRecord[],
): Promise<number> {
  let count = 0;
  for (const r of records) {
    const stmt = db
      .prepare(
        `INSERT OR REPLACE INTO indigenous_fn_transparency
         (id, community_name, fiscal_year, position_title, individual_name,
          total_compensation, base_salary, taxable_benefits, is_elected,
          source_url, ingested_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        r.id, r.communityName, r.fiscalYear, r.positionTitle, r.individualName,
        r.totalCompensation, r.baseSalary, r.taxableBenefits,
        r.isElected ? 1 : 0, r.sourceUrl, r.ingestedAt,
      );
    await stmt.run();
    count++;
  }
  return count;
}

async function persistTrcTracker(
  db: D1Database,
  records: TrcCallToAction[],
): Promise<number> {
  let count = 0;
  for (const r of records) {
    const stmt = db
      .prepare(
        `INSERT OR REPLACE INTO indigenous_trc_tracker
         (id, call_number, category, sub_category, title, call_text,
          status, assessment_date, responsible_entity, isc_involvement,
          progress_notes, source_url, ingested_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        r.id, r.callNumber, r.category, r.subCategory, r.title, r.callText,
        r.status, r.assessmentDate, r.responsibleEntity, r.iscInvolvement,
        r.progressNotes, r.sourceUrl, r.ingestedAt,
      );
    await stmt.run();
    count++;
  }
  return count;
}

/* ------------------------------------------------------------------ */
/*  Pipeline Orchestrators                                              */
/* ------------------------------------------------------------------ */

/**
 * Ingest CIRNAC land claims (specific + comprehensive) with optional
 * D1 persistence.
 */
export async function ingestLandClaims(
  db: D1Database | null,
  options: { limit?: number } = {},
): Promise<IndigenousIngestionResult> {
  const { limit = DEFAULT_MAX_RECORDS } = options;
  return runPipeline(
    INDIGENOUS_SOURCE_NAMES.CIRNAC_LAND_CLAIMS,
    () => fetchLandClaims(limit),
    db ? (records) => persistLandClaims(db, records as LandClaim[]) : undefined,
  );
}

/**
 * Ingest ISC health, education, and infrastructure community spending
 * with optional D1 persistence.
 */
export async function ingestIscPrograms(
  db: D1Database | null,
  options: { limit?: number } = {},
): Promise<IndigenousIngestionResult> {
  const { limit = DEFAULT_MAX_RECORDS } = options;
  const start = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;

  try {
    const [health, education, infrastructure] = await Promise.all([
      fetchIscHealthSpending(limit),
      fetchIscEducationSpending(limit),
      fetchIscInfrastructureSpending(limit),
    ]);

    const allRecords = [...health, ...education, ...infrastructure];
    recordsFound = allRecords.length;

    if (db && allRecords.length > 0) {
      try {
        recordsIngested = await persistIscPrograms(db, allRecords);
      } catch (persistErr) {
        const msg = persistErr instanceof Error ? persistErr.message : String(persistErr);
        errors.push(`persist: ${msg}`);
      }
    } else {
      recordsIngested = allRecords.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
  }

  return {
    source: 'isc-programs',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - start,
  };
}

/**
 * Ingest First Nations financial transparency records (chief & council
 * salaries) with optional D1 persistence.
 */
export async function ingestFnTransparency(
  db: D1Database | null,
  options: { limit?: number } = {},
): Promise<IndigenousIngestionResult> {
  const { limit = DEFAULT_MAX_RECORDS } = options;
  return runPipeline(
    INDIGENOUS_SOURCE_NAMES.FN_TRANSPARENCY,
    () => fetchFnTransparencyRecords(limit),
    db ? (records) => persistFnTransparency(db, records as FnTransparencyRecord[]) : undefined,
  );
}

/**
 * Ingest TRC Calls to Action tracker (all 94 calls) with optional D1
 * persistence.
 */
export async function ingestTrcCalls(
  db: D1Database | null,
  options: { limit?: number } = {},
): Promise<IndigenousIngestionResult> {
  const { limit = DEFAULT_MAX_RECORDS } = options;
  return runPipeline(
    INDIGENOUS_SOURCE_NAMES.TRC_CALLS_TO_ACTION,
    () => fetchAllTrcCalls(limit),
    db ? (records) => persistTrcTracker(db, records as TrcCallToAction[]) : undefined,
  );
}

/**
 * Run all four indigenous-relations sub-pipelines in parallel:
 *   - Land claims (CIRNAC)
 *   - ISC programs (health, education, infrastructure)
 *   - FN financial transparency
 *   - TRC Calls to Action
 *
 * Returns results for each pipeline.
 */
export async function ingestAllIndigenous(
  db: D1Database | null,
  options: {
    onProgress?: (msg: string) => void;
    limit?: number;
  } = {},
): Promise<IndigenousIngestionResult[]> {
  const log = options.onProgress || (() => {});
  log('Indigenous relations: starting all 4 pipelines in parallel');

  const results = await Promise.all([
    ingestLandClaims(db, options).then((r) => {
      log(`  Land claims: ${r.recordsFound} found, ${r.recordsIngested} ingested in ${r.durationMs}ms`);
      return r;
    }),
    ingestIscPrograms(db, options).then((r) => {
      log(`  ISC programs: ${r.recordsFound} found, ${r.recordsIngested} ingested in ${r.durationMs}ms`);
      return r;
    }),
    ingestFnTransparency(db, options).then((r) => {
      log(`  FN transparency: ${r.recordsFound} found, ${r.recordsIngested} ingested in ${r.durationMs}ms`);
      return r;
    }),
    ingestTrcCalls(db, options).then((r) => {
      log(`  TRC tracker: ${r.recordsFound} found, ${r.recordsIngested} ingested in ${r.durationMs}ms`);
      return r;
    }),
  ]);

  const totalFound = results.reduce((s, r) => s + r.recordsFound, 0);
  const totalIngested = results.reduce((s, r) => s + r.recordsIngested, 0);
  const totalDuration = Math.max(...results.map((r) => r.durationMs));

  log(`Indigenous relations: done — ${totalFound} total found, ${totalIngested} ingested in ${totalDuration}ms`);

  return results;
}

/* ------------------------------------------------------------------ */
/*  Cross-Reference Generation                                          */
/* ------------------------------------------------------------------ */

/**
 * Cross-reference known Indigenous communities against tracked lobbying
 * and influence data sources.
 *
 * For each tracked community, queries lobbying_registrations table
 * for community name matches in registrant or subject fields.
 * Returns a summary of cross-reference findings.
 */
export async function generateIndigenousCrossReferences(
  db: D1Database | null,
): Promise<{
  source: string;
  communitiesChecked: number;
  crossReferencesFound: number;
  details: { community: string; matchCount: number }[];
  durationMs: number;
}> {
  const start = Date.now();
  const details: { community: string; matchCount: number }[] = [];

  try {
    for (const community of TRACKED_COMMUNITIES) {
      let matchCount = 0;

      if (db) {
        try {
          // Check lobbying table for community name matches
          const result = await db
            .prepare(
              `SELECT COUNT(*) as cnt FROM lobbying_registrations
               WHERE registrant_name LIKE ? OR subject_matter LIKE ?`,
            )
            .bind(`%${community.name}%`, `%${community.name}%`)
            .first<{ cnt: number }>();
          matchCount = result?.cnt ?? 0;
        } catch {
          // lobbying table may not exist; fall back
        }
      }

      details.push({
        community: community.name,
        matchCount,
      });
    }
  } catch (err) {
    // If anything fails, return partial results
  }

  const crossReferencesFound = details.reduce((s, d) => s + d.matchCount, 0);

  return {
    source: 'indigenous-cross-references',
    communitiesChecked: TRACKED_COMMUNITIES.length,
    crossReferencesFound,
    details,
    durationMs: Date.now() - start,
  };
}

/* ------------------------------------------------------------------ */
/*  Type Re-exports                                                     */
/* ------------------------------------------------------------------ */

export type {
  LandClaim,
  IscCommunitySpending,
  FnTransparencyRecord,
  TrcCallToAction,
  SelfGovernmentAgreement,
  IndigenousIngestionResult,
} from './types.js';
