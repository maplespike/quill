/**
 * CanLII Ingestion — Quill
 *
 * Orchestrates the CanLII court decisions ingestion pipeline:
 *   1. Search / browse for new decisions from tracked courts
 *   2. Fetch case detail metadata for each decision
 *   3. Fetch citation graphs (cited/citing cases, cited legislation)
 *   4. Parse into CanliiDecision objects
 *   5. Persist to D1 database with SHA-256 record IDs
 *
 * News value:
 *   - Every decision that reviews a government action interprets a regulation.
 *   - Cross-reference with tracked companies (are they litigating?)
 *   - Cross-reference with tracked influence actors (interveners in court cases)
 *
 * Designed to run as a cron job (daily/weekly) or ad-hoc via CLI.
 *
 * Architecture:
 *   - Single query: searchDecisions()
 *   - By court: getRecentByCourt()
 *   - Bulk: ingestDecisions()
 */

import {
  searchCanlii,
  fetchCaseList,
  fetchDecisionDetail,
  fetchCitedCases,
  fetchCitingCases,
  fetchCitedLegislation,
  CanliiFetchError,
} from './fetcher.js';
import {
  parseDecisionDetail,
  parseCaseListItem,
  enrichWithCitations,
  hashCitation,
} from './parser.js';
import {
  TRACKED_COURTS,
  TRACKED_COURT_LIST,
  CANLII_DECISIONS_DDL,
  CANLII_CITATIONS_DDL,
  CANLII_DDL,
  caseBrowseUrl,
  TRACKED_GOV_DEPARTMENTS,
  TRACKED_LEGISLATION_KEYWORDS,
} from './constants.js';
import type {
  CanliiDecision,
  CanliiIngestionResult,
  Court,
  LegalCitation,
  TrackedCourt,
} from './types.js';
import type { D1Database } from '../committees/db.js';


/**
 * Ingest recent decisions from all tracked courts.
 *
 * Steps:
 *   1. For each tracked court, fetch recent decisions
 *   2. For each new decision, fetch detail metadata
 *   3. Optionally fetch citation graphs
 *   4. Persist to database (when provided)
 *   5. Cross-reference with tracked entities (deferred — metadata only for now)
 *
 * @param db - D1 database instance (or null to skip persistence)
 * @param options - Ingestion options
 * @returns Aggregated ingestion results
 */
export async function ingestDecisions(
  db: D1Database | null,
  options: {
    /** Courts to ingest (default: all tracked courts) */
    courts?: TrackedCourt[];
    /** Max decisions per court (default: 20) */
    limit?: number;
    /** Re-fetch and re-parse already-ingested decisions */
    force?: boolean;
    /** Fetch citation graphs (slower but richer) */
    fetchCitations?: boolean;
    /** Ingest decisions from a specific date range */
    since?: string;
    /** Concurrency limit for API calls */
    concurrency?: number;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<CanliiIngestionResult> {
  const startTime = Date.now();
  const result: CanliiIngestionResult = {
    courts: options.courts ?? TRACKED_COURT_LIST.map(c => c.courtId),
    decisionsFound: 0,
    decisionsIngested: 0,
    citationsFound: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const courtTargets = options.courts ?? (TRACKED_COURT_LIST.map(c => c.courtId));
  const concurrency = options.concurrency ?? 2;

  for (const courtId of courtTargets) {
    const court = TRACKED_COURTS[courtId];
    if (!court) {
      result.errors.push(`Unknown court: ${courtId}`);
      continue;
    }

    try {
      await ingestSingleCourt(db, court, options, result, log);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`[${courtId}] FATAL: ${msg}`);
      log(`[${court.databaseId}] FATAL: ${msg}`);
    }
  }

  result.durationMs = Date.now() - startTime;
  log(`\n=== CanLII Summary ===`);
  log(`Courts: ${result.courts.length}, Found: ${result.decisionsFound}, Ingested: ${result.decisionsIngested}, Citations: ${result.citationsFound}, Errors: ${result.errors.length}`);

  return result;
}


async function ingestSingleCourt(
  db: D1Database | null,
  court: Court,
  options: {
    limit?: number;
    force?: boolean;
    fetchCitations?: boolean;
    since?: string;
    concurrency?: number;
  },
  result: CanliiIngestionResult,
  log: (msg: string) => void,
): Promise<void> {
  log(`[${court.databaseId}] Fetching decision list...`);

  // Phase 1: Fetch case list
  const caseList = await fetchCaseList(court.databaseId, {
    resultCount: options.limit ?? 20,
    decisionDateAfter: options.since,
  });

  if (!caseList || !caseList.cases || caseList.cases.length === 0) {
    log(`[${court.databaseId}] No decisions found (API key missing?)`);
    return;
  }

  result.decisionsFound += caseList.cases.length;
  log(`[${court.databaseId}] Found ${caseList.cases.length} decisions`);

  // Phase 2: Fetch detail + citations for each decision
  const items = caseList.cases.slice(0, options.limit ?? 20);
  const concurrencyLimit = options.concurrency ?? 2;

  for (let i = 0; i < items.length; i += concurrencyLimit) {
    const batch = items.slice(i, i + concurrencyLimit);
    await Promise.all(
      batch.map(async (item) => {
        const caseId = typeof item.caseId === 'object' ? item.caseId.en : item.caseId;
        if (!caseId) return;

        try {
          log(`[${court.databaseId}] Detail: ${caseId}...`);
          const detail = await fetchDecisionDetail(court.databaseId, caseId);
          if (!detail) return;

          const ingestedAt = new Date().toISOString();
          const decision = await parseDecisionDetail(detail, ingestedAt);
          if (!decision) return;

          // Phase 3: Fetch citations (optional)
          let citations: LegalCitation[] = [];
          if (options.fetchCitations) {
            try {
              const [cited, citing, legis] = await Promise.all([
                fetchCitedCases(court.databaseId, caseId),
                fetchCitingCases(court.databaseId, caseId),
                fetchCitedLegislation(court.databaseId, caseId),
              ]);

              const combined: any = {};
              if (cited?.citedCases) combined.citedCases = cited.citedCases;
              if (citing?.citingCases) combined.citingCases = citing.citingCases;
              if (legis?.citedLegislations) combined.citedLegislations = legis.citedLegislations;

              citations = enrichWithCitations(decision, combined);
              result.citationsFound += citations.length;

              // Recompute decision id to include citation data
              decision.id = await computeDecisionId(decision, ingestedAt);
            } catch (citErr) {
              log(`[${court.databaseId}] Citation fetch error for ${caseId}: ${citErr instanceof Error ? citErr.message : String(citErr)}`);
            }
          }

          // Phase 4: Persist
          if (db) {
            await upsertDecision(db, decision);
            for (const citation of citations) {
              citation.id = await hashCitation(decision.id, citation.citation, citation.type);
              await upsertCitation(db, decision.id, citation);
            }
          }

          result.decisionsIngested++;
          log(`[${court.databaseId}] ${caseId}: ${decision.caseName.substring(0, 60)}` +
            (citations.length > 0 ? ` [${citations.length} citations]` : ''));

        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`[${court.databaseId}] ${caseId}: ${msg}`);
          log(`[${court.databaseId}] ERROR: ${caseId}: ${msg}`);
        }
      }),
    );
  }
}


/**
 * Search CanLII decisions by query string.
 *
 * Searches across all tracked courts for matching decisions.
 * Results are parsed and returned as CanliiDecision objects.
 */
export async function searchDecisions(
  query: string,
  options: {
    /** Restrict to specific court */
    court?: TrackedCourt;
    /** Max results (default: 20) */
    limit?: number;
    /** Fetch citation graphs */
    fetchCitations?: boolean;
  } = {},
): Promise<CanliiDecision[]> {
  const databaseId = options.court ? TRACKED_COURTS[options.court]?.databaseId : undefined;
  const results = await searchCanlii(query, databaseId, {
    limit: options.limit ?? 20,
  });

  if (!results?.cases || results.cases.length === 0) return [];

  const ingestedAt = new Date().toISOString();
  const decisions: CanliiDecision[] = [];

  for (const item of results.cases) {
    const caseId = typeof item.caseId === 'object' ? item.caseId.en : item.caseId;
    if (!caseId) continue;

    // Try to get detail, fall back to list-level info
    if (item.databaseId) {
      try {
        const detail = await fetchDecisionDetail(item.databaseId, caseId);
        if (detail) {
          const decision = await parseDecisionDetail(detail, ingestedAt);
          if (decision) {
            if (options.fetchCitations) {
              try {
                const citedRes = await fetchCitedCases(item.databaseId, caseId);
                const citingRes = await fetchCitingCases(item.databaseId, caseId);
                const legisRes = await fetchCitedLegislation(item.databaseId, caseId);
                const combined: any = {};
                if (citedRes?.citedCases) combined.citedCases = citedRes.citedCases;
                if (citingRes?.citingCases) combined.citingCases = citingRes.citingCases;
                if (legisRes?.citedLegislations) combined.citedLegislations = legisRes.citedLegislations;
                enrichWithCitations(decision, combined);
              } catch {
                // Non-fatal
              }
            }
            decisions.push(decision);
            continue;
          }
        }
      } catch {
        // Fall through to list-level parse
      }
    }

    // Fallback: parse from list item
    const parsed = await parseCaseListItem(item, ingestedAt);
    if (parsed) {
      decisions.push(parsed);
    }
  }

  return decisions;
}


/**
 * Get the most recent decisions from a specific court.
 */
export async function getRecentByCourt(
  db: D1Database | null,
  courtId: TrackedCourt,
  options: {
    limit?: number;
    /** Fetch citation graphs */
    fetchCitations?: boolean;
    /** Only decisions newer than this date */
    since?: string;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<CanliiIngestionResult> {
  return ingestDecisions(db, {
    courts: [courtId],
    limit: options.limit ?? 20,
    fetchCitations: options.fetchCitations,
    since: options.since,
    onProgress: options.onProgress,
  });
}


/**
 * Insert or ignore a CanLII decision in the database.
 */
async function upsertDecision(
  db: D1Database,
  decision: CanliiDecision,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO canlii_decisions
      (id, database_id, case_id, case_name, court, decision_date,
       docket_number, citation, all_citations, url, language, keywords,
       concatenated_id, summary, parties_json, cited_cases_json,
       citing_cases_json, cited_legislation_json,
       reviews_government_action, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    decision.id,
    decision.databaseId,
    decision.caseId,
    decision.caseName,
    decision.court,
    decision.decisionDate,
    decision.docketNumber,
    decision.citation,
    decision.allCitations,
    decision.url,
    decision.language,
    decision.keywords,
    decision.concatenatedId,
    decision.summary,
    decision.parties ? JSON.stringify(decision.parties) : null,
    decision.citedCasesJson,
    decision.citingCasesJson,
    decision.citedLegislationJson,
    decision.reviewsGovernmentAction ? 1 : 0,
    decision.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Insert or ignore a citation record.
 */
async function upsertCitation(
  db: D1Database,
  decisionId: string,
  citation: LegalCitation,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO canlii_citations
      (id, decision_id, cited_database_id, cited_case_id, cited_title,
       cited_citation, citation_type, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    citation.id,
    decisionId,
    citation.databaseId,
    citation.caseId,
    citation.title,
    citation.citation,
    citation.type,
    new Date().toISOString(),
  );

  const result = await stmt.run();
  return result.success;
}


/**
 * Initialize the canlii_decisions and canlii_citations tables.
 */
export async function initializeCanliiTables(db: D1Database): Promise<void> {
  await db.exec(CANLII_DDL);
}

/**
 * Check if the canlii_decisions table exists.
 */
export async function canliiTablesExist(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='canlii_decisions'",
    ).first<{ name: string }>();
    return !!row;
  } catch {
    return false;
  }
}


/**
 * Compute a deterministic SHA-256 hash for a decision.
 * Includes citation data in the hash if available for content verification.
 */
async function computeDecisionId(
  decision: CanliiDecision,
  ingestedAt: string,
): Promise<string> {
  const { computeHash } = await import('../../verification/hashing.js');
  const content = [
    decision.databaseId,
    decision.caseId,
    decision.caseName,
    decision.citation,
    decision.citedCasesJson,
    decision.citingCasesJson,
    decision.citedLegislationJson,
    ingestedAt,
  ].join('|');
  return computeHash(content, 'sha256');
}

export { CANLII_DECISIONS_DDL, CANLII_CITATIONS_DDL, CANLII_DDL };
