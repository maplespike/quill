// SPDX-License-Identifier: AGPL-3.0-only
/**
export { parseCscPopulation, parseCscPopulations } from './parser.js';
 * Criminal Justice Ingestion Orchestration — Quill
 *
 * Orchestrates the four criminal justice data pipelines:
 *   - CSC (Correctional Service Canada) — prison population, incidents, deaths, costs
 *   - Parole Board of Canada — parole decisions by offence and region
 *   - RCMP crime statistics — hate crimes, organized crime, crime severity index
 *   - PPSC (Public Prosecution Service of Canada) — caseloads, outcomes, stay rates
 *
 * Each returns a CriminalJusticeIngestionResult for pipeline tracking.
 * ingestAllCriminalJustice() runs all four pipelines in parallel.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  CRIMINAL_JUSTICE_SOURCE_NAMES,
} from './constants.js';
import {
  fetchCscPopulation,
  fetchCscIncidents,
  fetchCscDeaths,
  fetchCscCosts,
} from './csc.js';
import {
  fetchParoleDecisions,
  fetchParoleDecisionsAlternative,
} from './parole.js';
import {
  fetchHateCrimes,
  fetchOrganizedCrime,
  fetchCrimeSeverity,
} from './rcmp.js';
import {
  fetchPpscCaseloads,
  fetchPpscOutcomes,
  computeStayRates,
} from './ppsc.js';
import type { CriminalJusticeIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  Helper — run a named pipeline with timing                          */
/* ------------------------------------------------------------------ */

async function runPipeline(
  source: string,
  fn: () => Promise<unknown[]>,
  onProgress?: (msg: string) => void,
): Promise<CriminalJusticeIngestionResult> {
  const startTime = Date.now();
  const result: CriminalJusticeIngestionResult = {
    source,
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };
  const log = onProgress ?? (() => {});

  try {
    const records = await fn();
    result.recordsFound = records.length;
    result.recordsIngested = records.length;
    log(`[CriminalJustice] ${source}: ${records.length} records`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[CriminalJustice] ERROR (${source}): ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  CSC Corrections Ingestion                                          */
/* ------------------------------------------------------------------ */

/**
 * Ingest all Correctional Service Canada data pipelines:
 * population, incidents, deaths in custody, and cost per inmate.
 */
export async function ingestCorrections(
  options: {
    onProgress?: (msg: string) => void;
    limit?: number;
  } = {},
): Promise<CriminalJusticeIngestionResult> {
  const startTime = Date.now();
  const result: CriminalJusticeIngestionResult = {
    source: 'csc-corrections',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };
  const log = options.onProgress ?? (() => {});

  try {
    const lim = options.limit;

    const [population, incidents, deaths, costs] = await Promise.all([
      fetchCscPopulation(lim),
      fetchCscIncidents(lim),
      fetchCscDeaths(lim),
      fetchCscCosts(lim),
    ]);

    result.recordsFound =
      population.length + incidents.length + deaths.length + costs.length;
    result.recordsIngested = result.recordsFound;

    log(`[CSC] Population: ${population.length} records`);
    log(`[CSC] Incidents: ${incidents.length} records`);
    log(`[CSC] Deaths in Custody: ${deaths.length} records`);
    log(`[CSC] Cost per Inmate: ${costs.length} records`);
    log(`[CSC] Total: ${result.recordsFound} records ingested`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[CSC] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Parole Board of Canada Ingestion                                   */
/* ------------------------------------------------------------------ */

/**
 * Ingest Parole Board of Canada decision data.
 * Tries the primary CKAN dataset first, falls back to the alternative
 * dataset (provincial/territorial parole statistics).
 */
export async function ingestParole(
  options: {
    onProgress?: (msg: string) => void;
    limit?: number;
  } = {},
): Promise<CriminalJusticeIngestionResult> {
  const startTime = Date.now();
  const result: CriminalJusticeIngestionResult = {
    source: CRIMINAL_JUSTICE_SOURCE_NAMES.PAROLE_DECISIONS,
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };
  const log = options.onProgress ?? (() => {});

  try {
    const lim = options.limit;

    // Primary dataset
    const decisions = await fetchParoleDecisions(lim);

    if (decisions.length === 0) {
      // Fallback to alternative dataset
      const altDecisions = await fetchParoleDecisionsAlternative(lim);
      result.recordsFound = altDecisions.length;
      result.recordsIngested = altDecisions.length;
      log(`[Parole] Alternative dataset: ${altDecisions.length} records`);
    } else {
      result.recordsFound = decisions.length;
      result.recordsIngested = decisions.length;
      log(`[Parole] Primary dataset: ${decisions.length} records`);

      // Breakdown by parole type
      const byType = new Map<string, number>();
      for (const d of decisions) {
        const t = d.paroleType || 'Unknown';
        byType.set(t, (byType.get(t) ?? 0) + d.totalDecisions);
      }
      for (const [type, count] of byType) {
        log(`[Parole]   ${type}: ${count} decisions`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[Parole] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  RCMP Crime Statistics Ingestion                                    */
/* ------------------------------------------------------------------ */

/**
 * Ingest RCMP crime statistics: hate crimes, organized crime, and crime severity index.
 */
export async function ingestRcmpStats(
  options: {
    onProgress?: (msg: string) => void;
    limit?: number;
  } = {},
): Promise<CriminalJusticeIngestionResult> {
  const startTime = Date.now();
  const result: CriminalJusticeIngestionResult = {
    source: 'rcmp-crime-stats',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };
  const log = options.onProgress ?? (() => {});

  try {
    const lim = options.limit;

    const [hateCrimes, organizedCrime, crimeSeverity] = await Promise.all([
      fetchHateCrimes(lim),
      fetchOrganizedCrime(lim),
      fetchCrimeSeverity(lim),
    ]);

    result.recordsFound =
      hateCrimes.length + organizedCrime.length + crimeSeverity.length;
    result.recordsIngested = result.recordsFound;

    log(`[RCMP] Hate Crimes: ${hateCrimes.length} records`);
    log(`[RCMP] Organized Crime: ${organizedCrime.length} records`);
    log(`[RCMP] Crime Severity Index: ${crimeSeverity.length} records`);
    log(`[RCMP] Total: ${result.recordsFound} records ingested`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[RCMP] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  PPSC Prosecutions Ingestion                                        */
/* ------------------------------------------------------------------ */

/**
 * Ingest Public Prosecution Service of Canada data:
 * caseloads, outcomes, and computed stay rates.
 */
export async function ingestProsecutions(
  options: {
    onProgress?: (msg: string) => void;
    limit?: number;
  } = {},
): Promise<CriminalJusticeIngestionResult> {
  const startTime = Date.now();
  const result: CriminalJusticeIngestionResult = {
    source: 'ppsc-prosecutions',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };
  const log = options.onProgress ?? (() => {});

  try {
    const lim = options.limit;

    const [caseloads, outcomes] = await Promise.all([
      fetchPpscCaseloads(lim),
      fetchPpscOutcomes(lim),
    ]);

    // Compute stay rates from outcomes (derived data, not persisted directly here)
    const stayRates = computeStayRates(outcomes);

    result.recordsFound =
      caseloads.length + outcomes.length + stayRates.length;
    result.recordsIngested = result.recordsFound;

    log(`[PPSC] Caseloads: ${caseloads.length} records`);
    log(`[PPSC] Outcomes: ${outcomes.length} records`);
    log(`[PPSC] Stay Rates: ${stayRates.length} computed`);
    log(`[PPSC] Total: ${result.recordsFound} records ingested`);

    // Log notable stay rates
    const highStayRates = stayRates.filter(s => s.stayRate !== null && s.stayRate > 20);
    for (const sr of highStayRates) {
      log(`[PPSC]   ${sr.courtLevel} (${sr.fiscalYear}): ${(sr.stayRate as number).toFixed(1)}% stay rate`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[PPSC] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Master Ingestion — Run All Pipelines                               */
/* ------------------------------------------------------------------ */

/**
 * Run all criminal justice ingestion pipelines in parallel.
 * This is the primary entry point for cron job scheduling.
 */
export async function ingestAllCriminalJustice(
  options: {
    onProgress?: (msg: string) => void;
    limit?: number;
  } = {},
): Promise<Record<string, CriminalJusticeIngestionResult>> {
  const log = options.onProgress ?? (() => {});
  log('[CriminalJustice] Starting all ingestion pipelines...');

  const [corrections, parole, rcmpStats, prosecutions] = await Promise.all([
    ingestCorrections(options),
    ingestParole(options),
    ingestRcmpStats(options),
    ingestProsecutions(options),
  ]);

  const total =
    corrections.recordsIngested +
    parole.recordsIngested +
    rcmpStats.recordsIngested +
    prosecutions.recordsIngested;

  const totalErrors =
    corrections.errors.length +
    parole.errors.length +
    rcmpStats.errors.length +
    prosecutions.errors.length;

  log(`[CriminalJustice] Done — ${total} total records across 4 pipelines, ${totalErrors} error(s)`);

  return {
    corrections,
    parole,
    rcmpStats,
    prosecutions,
  };
}

/* ------------------------------------------------------------------ */
/*  Cross-Reference: Criminal Justice ↔ Influence / Lobbying          */
/* ------------------------------------------------------------------ */

/**
 * Generate cross-reference links between criminal justice agencies
 * and the influence/lobbying tracking module.
 *
 * Maps each department/agency to:
 *   - Expected lobbying subject categories
 *   - Oversight committee(s)
 *   - Related corporate entities (NGOs, IOs, think tanks)
 *
 * These references are used by generateHypotheticalConnections() to
 * surface money-in-politics links between lobbying actors and the
 * criminal justice system.
 */
export function generateJusticeCrossReferences(): {
  agency: string;
  agencyType: 'corrections' | 'parole' | 'policing' | 'prosecution';
  expectedLobbyingSubjects: string[];
  oversightCommittees: string[];
  relatedInfluenceCategories: string[];
}[] {
  return [
    {
      agency: 'Correctional Service Canada (CSC)',
      agencyType: 'corrections',
      expectedLobbyingSubjects: [
        'Justice and Law Enforcement',
        'Public Safety',
        'Health',
        'Housing',
        'Employment and Training',
      ],
      oversightCommittees: [
        'SECU — Standing Committee on Public Safety and National Security',
      ],
      relatedInfluenceCategories: [
        'prison-abolition',
        'criminal-justice-reform',
        'human-rights',
        'corrections-technology',
        'rehabilitation-services',
      ],
    },
    {
      agency: 'Parole Board of Canada (PBC)',
      agencyType: 'parole',
      expectedLobbyingSubjects: [
        'Justice and Law Enforcement',
        'Public Safety',
        'Human Rights',
      ],
      oversightCommittees: [
        'SECU — Standing Committee on Public Safety and National Security',
        'JUST — Standing Committee on Justice and Human Rights',
      ],
      relatedInfluenceCategories: [
        'criminal-justice-reform',
        'human-rights',
        'victims-advocacy',
      ],
    },
    {
      agency: 'Royal Canadian Mounted Police (RCMP)',
      agencyType: 'policing',
      expectedLobbyingSubjects: [
        'Justice and Law Enforcement',
        'Public Safety',
        'National Security',
        'Defence',
        'Aboriginal Affairs',
      ],
      oversightCommittees: [
        'SECU — Standing Committee on Public Safety and National Security',
      ],
      relatedInfluenceCategories: [
        'policing-reform',
        'surveillance',
        'law-enforcement-technology',
        'human-rights',
        'indigenous-rights',
      ],
    },
    {
      agency: 'Public Prosecution Service of Canada (PPSC)',
      agencyType: 'prosecution',
      expectedLobbyingSubjects: [
        'Justice and Law Enforcement',
        'Constitutional Issues',
        'Aboriginal Affairs',
        'Health',
      ],
      oversightCommittees: [
        'JUST — Standing Committee on Justice and Human Rights',
      ],
      relatedInfluenceCategories: [
        'prosecutorial-reform',
        'criminal-justice-reform',
        'human-rights',
        'indigenous-rights',
        'drug-policy',
      ],
    },
  ];
}
