/**
 * Transport Infrastructure — Quill
 *
 * Orchestrates ingestion of Canadian transportation safety, infrastructure
 * funding, and regulatory data across 6 agencies:
 *   - TSB: Transportation Safety Board (occurrences/investigations)
 *   - Transport Canada: safety recalls, violations, audits, fines
 *   - CIIB: Canada Infrastructure Bank ($35B loan mandate)
 *   - CTA: Canadian Transportation Agency (airline rulings, accessibility)
 *   - Infrastructure Canada: project funding by riding/party
 *   - National Trade Corridors Fund: projects, rationale, amounts
 *
 * Source terms vary by publisher and dataset; public access does not establish reuse permission.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  TRANSPORT_SOURCE_NAMES,
  DEFAULT_MAX_RECORDS,
} from './constants.js';
import type { TransportInfrastructureIngestionResult } from './types.js';
import type { TsbOccurrence, TcRecall, TcViolationAudit, CiibProject, CtaRuling, InfrastructureFunding, NtcfProject } from './types.js';

import { fetchTsbOccurrences } from './tsb.js';
import { fetchTcVehicleRecalls, fetchTcViolationsAudits } from './tc-safety.js';
import { fetchCiibProjects } from './ciib.js';
import { fetchCtaRulings, fetchCtaDecisions } from './cta.js';
import { fetchInfrastructureProjects, fetchNationalTradeCorridors, fetchCanadaInfrastructureBank } from './infrastructure-canada.js';

/* ------------------------------------------------------------------ */
/*  Individual Ingestion Functions                                     */
/* ------------------------------------------------------------------ */

/**
 * Ingest TSB occurrence data.
 */
export async function ingestTsbOccurrences(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<TransportInfrastructureIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];

  try {
    const records = await fetchTsbOccurrences(maxRecords);
    return {
      source: TRANSPORT_SOURCE_NAMES.TSB_OCCURRENCES,
      recordsFound: records.length,
      recordsIngested: records.length,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      source: TRANSPORT_SOURCE_NAMES.TSB_OCCURRENCES,
      recordsFound: 0,
      recordsIngested: 0,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Ingest Transport Canada safety recall data.
 */
export async function ingestTcSafety(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<TransportInfrastructureIngestionResult[]> {
  const start = Date.now();
  const results: TransportInfrastructureIngestionResult[] = [];

  // Recalls
  const recallsStart = Date.now();
  try {
    const recalls = await fetchTcVehicleRecalls(maxRecords);
    results.push({
      source: TRANSPORT_SOURCE_NAMES.TC_RECALLS,
      recordsFound: recalls.length,
      recordsIngested: recalls.length,
      errors: [],
      durationMs: Date.now() - recallsStart,
    });
  } catch (err) {
    results.push({
      source: TRANSPORT_SOURCE_NAMES.TC_RECALLS,
      recordsFound: 0,
      recordsIngested: 0,
      errors: [err instanceof Error ? err.message : String(err)],
      durationMs: Date.now() - recallsStart,
    });
  }

  // Violations & audits
  const violStart = Date.now();
  try {
    const violations = await fetchTcViolationsAudits(maxRecords);
    results.push({
      source: TRANSPORT_SOURCE_NAMES.TC_VIOLATIONS,
      recordsFound: violations.length,
      recordsIngested: violations.length,
      errors: [],
      durationMs: Date.now() - violStart,
    });
  } catch (err) {
    results.push({
      source: TRANSPORT_SOURCE_NAMES.TC_VIOLATIONS,
      recordsFound: 0,
      recordsIngested: 0,
      errors: [err instanceof Error ? err.message : String(err)],
      durationMs: Date.now() - violStart,
    });
  }

  return results;
}

/**
 * Ingest CTA (Canadian Transportation Agency) ruling data.
 */
export async function ingestCtaRulings(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<TransportInfrastructureIngestionResult[]> {
  const start = Date.now();
  const results: TransportInfrastructureIngestionResult[] = [];

  // Airline rulings & accessibility complaints
  const rulingsStart = Date.now();
  try {
    const rulings = await fetchCtaRulings(maxRecords);
    results.push({
      source: TRANSPORT_SOURCE_NAMES.CTA_RULINGS,
      recordsFound: rulings.length,
      recordsIngested: rulings.length,
      errors: [],
      durationMs: Date.now() - rulingsStart,
    });
  } catch (err) {
    results.push({
      source: TRANSPORT_SOURCE_NAMES.CTA_RULINGS,
      recordsFound: 0,
      recordsIngested: 0,
      errors: [err instanceof Error ? err.message : String(err)],
      durationMs: Date.now() - rulingsStart,
    });
  }

  // Regulatory decisions
  const decisionsStart = Date.now();
  try {
    const decisions = await fetchCtaDecisions(maxRecords);
    results.push({
      source: 'cta-decisions',
      recordsFound: decisions.length,
      recordsIngested: decisions.length,
      errors: [],
      durationMs: Date.now() - decisionsStart,
    });
  } catch (err) {
    results.push({
      source: 'cta-decisions',
      recordsFound: 0,
      recordsIngested: 0,
      errors: [err instanceof Error ? err.message : String(err)],
      durationMs: Date.now() - decisionsStart,
    });
  }

  return results;
}

/**
 * Ingest Infrastructure Canada project funding data.
 */
export async function ingestInfrastructureProjects(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<TransportInfrastructureIngestionResult[]> {
  const start = Date.now();
  const results: TransportInfrastructureIngestionResult[] = [];

  // Investing in Canada infrastructure projects
  const infraStart = Date.now();
  try {
    const projects = await fetchInfrastructureProjects(maxRecords);
    results.push({
      source: TRANSPORT_SOURCE_NAMES.INFRASTRUCTURE_FUNDING,
      recordsFound: projects.length,
      recordsIngested: projects.length,
      errors: [],
      durationMs: Date.now() - infraStart,
    });
  } catch (err) {
    results.push({
      source: TRANSPORT_SOURCE_NAMES.INFRASTRUCTURE_FUNDING,
      recordsFound: 0,
      recordsIngested: 0,
      errors: [err instanceof Error ? err.message : String(err)],
      durationMs: Date.now() - infraStart,
    });
  }

  // NTCF projects
  const ntcfStart = Date.now();
  try {
    const ntcf = await fetchNationalTradeCorridors(maxRecords);
    results.push({
      source: TRANSPORT_SOURCE_NAMES.NTCF_PROJECTS,
      recordsFound: ntcf.length,
      recordsIngested: ntcf.length,
      errors: [],
      durationMs: Date.now() - ntcfStart,
    });
  } catch (err) {
    results.push({
      source: TRANSPORT_SOURCE_NAMES.NTCF_PROJECTS,
      recordsFound: 0,
      recordsIngested: 0,
      errors: [err instanceof Error ? err.message : String(err)],
      durationMs: Date.now() - ntcfStart,
    });
  }

  // CIIB projects (via ciib.ts)
  const ciibStart = Date.now();
  try {
    const ciib = await fetchCanadaInfrastructureBank(maxRecords);
    results.push({
      source: TRANSPORT_SOURCE_NAMES.CIIB_PROJECTS,
      recordsFound: ciib.length,
      recordsIngested: ciib.length,
      errors: [],
      durationMs: Date.now() - ciibStart,
    });
  } catch (err) {
    results.push({
      source: TRANSPORT_SOURCE_NAMES.CIIB_PROJECTS,
      recordsFound: 0,
      recordsIngested: 0,
      errors: [err instanceof Error ? err.message : String(err)],
      durationMs: Date.now() - ciibStart,
    });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Ingest All Transport Data (Parallel)                               */
/* ------------------------------------------------------------------ */

/**
 * Run all transport infrastructure ingestion jobs in parallel.
 *
 * Returns a flat array of ingestion results (one per source).
 */
export async function ingestAllTransport(
  maxRecordsPerSource = DEFAULT_MAX_RECORDS,
): Promise<TransportInfrastructureIngestionResult[]> {
  const results: TransportInfrastructureIngestionResult[] = [];

  const runners: Array<Promise<TransportInfrastructureIngestionResult | TransportInfrastructureIngestionResult[]>> = [
    ingestTsbOccurrences(maxRecordsPerSource),
    ingestTcSafety(maxRecordsPerSource),
    ingestCtaRulings(maxRecordsPerSource),
    ingestInfrastructureProjects(maxRecordsPerSource),
  ];

  const settled = await Promise.allSettled(runners);

  for (const s of settled) {
    if (s.status === 'fulfilled') {
      const value = s.value;
      if (Array.isArray(value)) {
        results.push(...value);
      } else {
        results.push(value);
      }
    } else {
      results.push({
        source: 'unknown-transport-source',
        recordsFound: 0,
        recordsIngested: 0,
        errors: [s.reason instanceof Error ? s.reason.message : String(s.reason)],
        durationMs: 0,
      });
    }
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Re-exports for convenience                                         */
/* ------------------------------------------------------------------ */

export {
  fetchTsbOccurrences,
} from './tsb.js';
export {
  fetchTcVehicleRecalls,
  fetchTcViolationsAudits,
} from './tc-safety.js';
export {
  fetchCiibProjects,
} from './ciib.js';
export {
  fetchCtaRulings,
  fetchCtaDecisions,
} from './cta.js';
export { parseTsbOccurrence, parseTsbOccurrences, normalizeDate, parseNumeric } from './parser.js';
export {
  fetchInfrastructureProjects,
  fetchNationalTradeCorridors,
  fetchCanadaInfrastructureBank,
} from './infrastructure-canada.js';
