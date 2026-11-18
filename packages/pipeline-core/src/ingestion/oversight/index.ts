// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Oversight Bodies Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for Canada's independent oversight bodies.
 * Currently supports OAG (Office of the Auditor General), PBO (Parliamentary Budget Officer),
 * Ethics Commissioner (CIEC), and Lobbying Commissioner (OCL).
 *
 * Architecture:
 *   - ingestBody(db, body, options?) — single body ingestion
 *   - ingestAllBodies(db, options?) — batch ingestion across all bodies
 *
 * Each body's fetch/parse pipeline:
 *   1. Fetch raw report listing (RSS -> API -> HTML scraping)
 *   2. Parse listing into structured OversightReport records
 *   3. Persist to D1 database
 *   4. Optionally fetch detail pages for recommendations/findings
 *
 * Recommendation tracking is the key feature: each report can have
 * associated recommendations with implementation status tracking.
 */

import { fetchOAGReports, fetchPBOReports, fetchEthicsInvestigations, fetchLobbyingInvestigations, fetchCompetitionBureauDecisions, fetchCRTCDecisions, OversightFetchError } from './fetcher.js';
import { parseOAGReportList, parsePBOReportList, parseEthicsReport, parseLobbyingInvestigation, parseCompetitionBureauList, parseCRTCList } from './parser.js';
import { computeHash } from '../../verification/hashing.js';
import { upsertOrganization } from '../../shared-db.js';
import {
  OVERSIGHT_BODIES,
  OAG_REPORTS_URL,
  PBO_PUBLICATIONS_URL,
  CIEC_INVESTIGATIONS_URL,
  OCL_INVESTIGATIONS_URL,
} from './constants.js';
import type {
  OversightBody,
  OversightReport,
  OversightIngestionResult,
  Investigation,
  RawOAGItem,
  RawPBOItem,
  RawEthicsItem,
  RawLobbyingItem,
  RawCompetitionBureauItem,
  RawCRTCItem,
} from './types.js';


export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  exec(sql: string): Promise<{ success: boolean; error?: string }>;
  batch(stmts: D1PreparedStatement[]): Promise<{ results?: unknown[]; success: boolean }[]>;
}

export interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { changes: number } }>;
}


export const OVERSIGHT_DDL = `
-- Oversight body reports (OAG, PBO, Ethics Commissioner, etc.)
CREATE TABLE IF NOT EXISTS oversight_reports (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL CHECK(body IN ('OAG','PBO','EthicsCommissioner','LobbyingCommissioner','CompetitionBureau','CRTC','PrivacyCommissioner','InformationCommissioner','OfficialLanguagesCommissioner','CanadianHumanRightsCommission')),
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  pdf_url TEXT,
  report_type TEXT NOT NULL,
  summary TEXT,
  findings_json TEXT,
  audited_entities_json TEXT,
  fiscal_year TEXT,
  report_number TEXT,
  language TEXT DEFAULT 'en',
  ingested_at TEXT NOT NULL,
  UNIQUE(body, url)
);

CREATE INDEX IF NOT EXISTS idx_or_body ON oversight_reports(body);
CREATE INDEX IF NOT EXISTS idx_or_date ON oversight_reports(date DESC);
CREATE INDEX IF NOT EXISTS idx_or_type ON oversight_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_or_fiscal ON oversight_reports(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_or_body_date ON oversight_reports(body, date DESC);

-- Oversight report recommendations
CREATE TABLE IF NOT EXISTS oversight_recommendations (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES oversight_reports(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('implemented','partially-implemented','not-implemented','in-progress','no-longer-valid','unknown')),
  responsible_entity TEXT,
  status_date TEXT,
  target_date TEXT,
  implementation_notes TEXT,
  ingested_at TEXT NOT NULL,
  UNIQUE(report_id, number)
);

CREATE INDEX IF NOT EXISTS idx_or_rec_report ON oversight_recommendations(report_id);
CREATE INDEX IF NOT EXISTS idx_or_rec_status ON oversight_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_or_rec_entity ON oversight_recommendations(responsible_entity);
CREATE INDEX IF NOT EXISTS idx_or_rec_report_status ON oversight_recommendations(report_id, status);
`;

/**
 * DDL for oversight_investigations table.
 * Used by Ethics Commissioner and Lobbying Commissioner which conduct
 * investigations (distinct from reports/audits).
 */
export const OVERSIGHT_INVESTIGATIONS_DDL = `
-- Oversight body investigations (Ethics Commissioner, Lobbying Commissioner, etc.)
CREATE TABLE IF NOT EXISTS oversight_investigations (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL CHECK(body IN ('EthicsCommissioner','LobbyingCommissioner','PrivacyCommissioner','InformationCommissioner','OfficialLanguagesCommissioner')),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  date_opened TEXT NOT NULL,
  date_closed TEXT,
  summary TEXT,
  findings_json TEXT,
  outcome TEXT,
  parties_json TEXT,
  url TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  UNIQUE(body, url)
);

CREATE INDEX IF NOT EXISTS idx_oi_body ON oversight_investigations(body);
CREATE INDEX IF NOT EXISTS idx_oi_subject ON oversight_investigations(subject);
CREATE INDEX IF NOT EXISTS idx_oi_date ON oversight_investigations(date_opened DESC);
CREATE INDEX IF NOT EXISTS idx_oi_outcome ON oversight_investigations(outcome);
CREATE INDEX IF NOT EXISTS idx_oi_body_subject ON oversight_investigations(body, subject);

-- Investigation recommendations
CREATE TABLE IF NOT EXISTS oversight_investigation_recommendations (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES oversight_investigations(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('implemented','partially-implemented','not-implemented','in-progress','no-longer-valid','unknown')),
  responsible_entity TEXT,
  status_date TEXT,
  target_date TEXT,
  implementation_notes TEXT,
  ingested_at TEXT NOT NULL,
  UNIQUE(investigation_id, number)
);

CREATE INDEX IF NOT EXISTS idx_oir_inv ON oversight_investigation_recommendations(investigation_id);
CREATE INDEX IF NOT EXISTS idx_oir_status ON oversight_investigation_recommendations(status);
`;


/**
 * Insert or ignore an oversight report.
 */
async function upsertReport(db: D1Database, report: OversightReport): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO oversight_reports
      (id, body, title, date, url, pdf_url, report_type, summary,
       findings_json, audited_entities_json, fiscal_year, report_number,
       language, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    report.id,
    report.body,
    report.title,
    report.date,
    report.url,
    report.pdfUrl,
    report.reportType,
    report.summary,
    JSON.stringify(report.findings),
    JSON.stringify(report.auditedEntities),
    report.fiscalYear,
    report.reportNumber,
    report.language,
    report.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Insert a recommendation for a report.
 */
async function insertRecommendation(
  db: D1Database,
  recommendation: import('./types.js').Recommendation,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO oversight_recommendations
      (id, report_id, text, number, status, responsible_entity,
       status_date, target_date, implementation_notes, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    recommendation.id,
    recommendation.reportId,
    recommendation.text,
    recommendation.number,
    recommendation.status,
    recommendation.responsibleEntity,
    recommendation.statusDate,
    recommendation.targetDate,
    recommendation.implementationNotes,
    recommendation.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Check if a report already exists by URL.
 */
async function reportExists(db: D1Database, body: OversightBody, url: string): Promise<boolean> {
  const row = await db.prepare(
    'SELECT 1 FROM oversight_reports WHERE body = ? AND url = ? LIMIT 1',
  ).bind(body, url).first();
  return row !== null;
}

/**
 * Get the latest report date for a body.
 */
async function getLatestReportDate(db: D1Database, body: OversightBody): Promise<string | null> {
  const row = await db.prepare(
    'SELECT date FROM oversight_reports WHERE body = ? ORDER BY date DESC LIMIT 1',
  ).bind(body).first<{ date: string }>();
  return row?.date ?? null;
}


/**
 * Insert or ignore an oversight investigation.
 */
async function upsertInvestigation(db: D1Database, inv: Investigation): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO oversight_investigations
      (id, body, title, subject, date_opened, date_closed, summary,
       findings_json, outcome, parties_json, url, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    inv.id,
    inv.body,
    inv.title,
    inv.subject,
    inv.dateOpened,
    inv.dateClosed,
    inv.summary,
    JSON.stringify(inv.findings),
    inv.outcome,
    JSON.stringify(inv.parties),
    inv.url,
    inv.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Insert an investigation recommendation.
 */
async function insertInvestigationRecommendation(
  db: D1Database,
  rec: import('./types.js').Recommendation,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO oversight_investigation_recommendations
      (id, investigation_id, text, number, status, responsible_entity,
       status_date, target_date, implementation_notes, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    rec.id,
    rec.reportId,
    rec.text,
    rec.number,
    rec.status,
    rec.responsibleEntity,
    rec.statusDate,
    rec.targetDate,
    rec.implementationNotes,
    rec.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Check if an investigation already exists by URL.
 */
async function investigationExists(db: D1Database, body: OversightBody, url: string): Promise<boolean> {
  const row = await db.prepare(
    'SELECT 1 FROM oversight_investigations WHERE body = ? AND url = ? LIMIT 1',
  ).bind(body, url).first();
  return row !== null;
}

/**
 * Get the latest investigation date for a body.
 */
async function getLatestInvestigationDate(db: D1Database, body: OversightBody): Promise<string | null> {
  const row = await db.prepare(
    'SELECT date_opened FROM oversight_investigations WHERE body = ? ORDER BY date_opened DESC LIMIT 1',
  ).bind(body).first<{ date_opened: string }>();
  return row?.date_opened ?? null;
}


/**
 * Fetch raw items from an oversight body.
 * Routes to the correct fetcher based on body type.
 */
async function fetchRawItems(
  body: OversightBody,
  options: { timeoutMs?: number; maxPages?: number } = {},
): Promise<RawOAGItem[] | RawPBOItem[] | RawEthicsItem[] | RawLobbyingItem[] | RawCompetitionBureauItem[] | RawCRTCItem[]> {
  switch (body) {
    case 'OAG':
      return fetchOAGReports(options);
    case 'PBO':
      return fetchPBOReports(options);
    case 'EthicsCommissioner':
      return fetchEthicsInvestigations(options);
    case 'LobbyingCommissioner':
      return fetchLobbyingInvestigations(options);
    case 'CompetitionBureau':
      return fetchCompetitionBureauDecisions(options);
    case 'CRTC':
      return fetchCRTCDecisions(options);
    default:
      throw new Error(`Unsupported oversight body: ${body}`);
  }
}

/**
 * Parse raw items into OversightReport records.
 * Routes to the correct parser based on body type.
 */
async function parseRawItems(
  body: OversightBody,
  items: RawOAGItem[] | RawPBOItem[] | RawCompetitionBureauItem[] | RawCRTCItem[],
): Promise<OversightReport[]> {
  switch (body) {
    case 'OAG':
      return parseOAGReportList(items as RawOAGItem[], body);
    case 'PBO':
      return parsePBOReportList(items as RawPBOItem[], body);
    case 'CompetitionBureau':
      return parseCompetitionBureauList(items as RawCompetitionBureauItem[], body);
    case 'CRTC':
      return parseCRTCList(items as RawCRTCItem[], body);
    default:
      throw new Error(`Unsupported oversight body: ${body}`);
  }
}

/**
 * Parse raw investigation items into Investigation records.
 */
async function parseInvestigationItems(
  body: OversightBody,
  items: RawEthicsItem[] | RawLobbyingItem[],
): Promise<Investigation[]> {
  const investigations: Investigation[] = [];

  for (const item of items) {
    const source = {
      title: item.title,
      date: item.date,
      url: item.url,
      subject: item.subject,
      parties: item.parties,
    };

    let investigation: Investigation;
    if (body === 'EthicsCommissioner') {
      investigation = parseEthicsReport(item.bodyHtml, source);
    } else if (body === 'LobbyingCommissioner') {
      investigation = parseLobbyingInvestigation(item.bodyHtml, source);
    } else {
      throw new Error(`Unsupported investigation body: ${body}`);
    }

    // Compute SHA-256 hash for the investigation ID
    const contentForHash = `${body}|${investigation.title}|${investigation.subject}|${investigation.url}`;
    const id = await computeHash(contentForHash, 'sha256');
    investigation.id = id;

    // Set reportId for each recommendation
    for (const rec of investigation.recommendations) {
      const recContent = `${id}|${rec.number}|${rec.text}`;
      rec.id = await computeHash(recContent, 'sha256');
      rec.reportId = id;
      rec.ingestedAt = investigation.ingestedAt;
    }

    investigations.push(investigation);
  }

  return investigations;
}

/**
 * Ingest all new reports from a single oversight body into the database.
 *
 * Steps:
 *   1. Fetch raw report listing
 *   2. Parse into structured reports
 *   3. Filter to new (unseen) reports
 *   4. Persist to D1
 */
export async function ingestBody(
  db: D1Database,
  body: OversightBody,
  options: {
    /** Only fetch the most recent N reports */
    limit?: number;
    /** Include already-ingested reports (re-parse) */
    force?: boolean;
    /** Start date filter (only reports on/after this date) */
    since?: string;
    /** Max pages to fetch for paginated sources */
    maxPages?: number;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<OversightIngestionResult> {
  const startTime = Date.now();
  const result: OversightIngestionResult = {
    body,
    reportsFound: 0,
    reportsIngested: 0,
    recommendationsFound: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const config = OVERSIGHT_BODIES[body];
  const reportsUrl = config.reportsUrl;

  try {
    log(`[${body}] Fetching from ${reportsUrl}...`);

    // Phase 1: Fetch raw items
    const rawItems = await fetchRawItems(body, {
      maxPages: options.maxPages ?? 5,
    });

    result.reportsFound = rawItems.length;
    log(`[${body}] Found ${rawItems.length} items`);

    if (rawItems.length === 0) {
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Route to report or investigation pipeline
    if (body === 'EthicsCommissioner' || body === 'LobbyingCommissioner') {
      await ingestInvestigations(db, body, rawItems as RawEthicsItem[] | RawLobbyingItem[], options, result, log);
    } else {
      await ingestReports(db, body, rawItems as RawOAGItem[] | RawPBOItem[] | RawCompetitionBureauItem[] | RawCRTCItem[], options, result, log);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Body ${body}: ${msg}`);
    log(`[${body}] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[${body}] Done in ${result.durationMs}ms: ${result.reportsIngested} reports` +
    (result.recommendationsFound > 0 ? `, ${result.recommendationsFound} recommendations` : '') +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));

  return result;
}

/**
 * Ingest report-type items (OAG, PBO).
 */
async function ingestReports(
  db: D1Database,
  body: OversightBody,
  rawItems: RawOAGItem[] | RawPBOItem[] | RawCompetitionBureauItem[] | RawCRTCItem[],
  options: {
    limit?: number;
    force?: boolean;
    since?: string;
    onProgress?: (msg: string) => void;
  },
  result: OversightIngestionResult,
  log: (msg: string) => void,
): Promise<void> {
  // Phase 2: Parse into structured records
  const allReports = await parseRawItems(body, rawItems);

  // Phase 3: Filter to new reports
  let toIngest = allReports;

  if (!options.force) {
    const existingCheck = await Promise.all(
      allReports.map(r => reportExists(db, body, r.url)),
    );
    toIngest = allReports.filter((_, i) => !existingCheck[i]);
  }

  if (options.limit && toIngest.length > options.limit) {
    toIngest = toIngest.slice(0, options.limit);
  }

  if (options.since) {
    toIngest = toIngest.filter(r => r.date >= options.since!);
  }

  if (toIngest.length === 0) {
    log(`[${body}] No new reports to ingest`);
    return;
  }

  log(`[${body}] Ingesting ${toIngest.length} new reports...`);

  // Phase 4: Persist reports
  for (const report of toIngest) {
    try {
      await upsertReport(db, report);
      result.reportsIngested++;

      // Also upsert audited entities to shared organizations table
      for (const entity of report.auditedEntities ?? []) {
        try {
          upsertOrganization(entity, { type: "government_department", source: `oversight-${body}`, rawData: { reportTitle: report.title } });
        } catch { /* non-fatal */ }
      }

      for (const rec of report.recommendations) {
        await insertRecommendation(db, rec);
        result.recommendationsFound++;
      }

      log(`[${body}] "${report.title.substring(0, 60)}..."` +
        (report.recommendations.length > 0
          ? ` (${report.recommendations.length} recommendations)`
          : ''));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`"${report.title}": ${msg}`);
      log(`[${body}] ERROR: ${msg}`);
    }
  }
}

/**
 * Ingest investigation-type items (Ethics Commissioner, Lobbying Commissioner).
 */
async function ingestInvestigations(
  db: D1Database,
  body: OversightBody,
  rawItems: RawEthicsItem[] | RawLobbyingItem[],
  options: {
    limit?: number;
    force?: boolean;
    since?: string;
    onProgress?: (msg: string) => void;
  },
  result: OversightIngestionResult,
  log: (msg: string) => void,
): Promise<void> {
  // Phase 2: Parse into structured investigations
  const allInvestigations = await parseInvestigationItems(body, rawItems);

  // Phase 3: Filter to new investigations
  let toIngest = allInvestigations;

  if (!options.force) {
    const existingCheck = await Promise.all(
      allInvestigations.map(inv => investigationExists(db, body, inv.url)),
    );
    toIngest = allInvestigations.filter((_, i) => !existingCheck[i]);
  }

  if (options.limit && toIngest.length > options.limit) {
    toIngest = toIngest.slice(0, options.limit);
  }

  if (options.since) {
    toIngest = toIngest.filter(inv => inv.dateOpened >= options.since!);
  }

  if (toIngest.length === 0) {
    log(`[${body}] No new investigations to ingest`);
    return;
  }

  log(`[${body}] Ingesting ${toIngest.length} new investigations...`);

  // Phase 4: Persist investigations
  for (const inv of toIngest) {
    try {
      // Ensure DDL is available — create table if not exists
      await upsertInvestigation(db, inv);
      result.reportsIngested++;

      for (const rec of inv.recommendations) {
        await insertInvestigationRecommendation(db, rec);
        result.recommendationsFound++;
      }

      log(`[${body}] "${inv.title.substring(0, 60)}..."` +
        (inv.recommendations.length > 0
          ? ` (${inv.recommendations.length} recommendations)`
          : ''));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`"${inv.title}": ${msg}`);
      log(`[${body}] ERROR: ${msg}`);
    }
  }
}


/**
 * Ingest ALL supported oversight bodies.
 * Returns results keyed by body name.
 */
export async function ingestAllBodies(
  db: D1Database,
  options: {
    /** Only these bodies (default: OAG, PBO, EthicsCommissioner, LobbyingCommissioner) */
    bodies?: OversightBody[];
    /** Only fetch the most recent N reports per body */
    limit?: number;
    /** Include already-ingested reports (re-parse) */
    force?: boolean;
    /** Start date filter */
    since?: string;
    /** Max pages per body for paginated sources */
    maxPages?: number;
    /** Concurrency limit (default: 2) */
    concurrency?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<Record<OversightBody, OversightIngestionResult>> {
  const targets = options.bodies ?? ['OAG', 'PBO', 'EthicsCommissioner', 'LobbyingCommissioner'];
  const log = options.onProgress ?? (() => {});
  const concurrency = options.concurrency ?? 2;

  log(`Ingesting ${targets.length} oversight bodies (concurrency: ${concurrency})...`);

  const results: Partial<Record<OversightBody, OversightIngestionResult>> = {};

  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(body => ingestBody(db, body, options)),
    );

    for (let j = 0; j < batch.length; j++) {
      results[batch[j]] = batchResults[j];
    }
  }

  // Summary
  const totalReports = Object.values(results).reduce((s, r) => s + r!.reportsIngested, 0);
  const totalRecs = Object.values(results).reduce((s, r) => s + r!.recommendationsFound, 0);
  const totalErrors = Object.values(results).reduce((s, r) => s + r!.errors.length, 0);
  log(`\n=== Oversight Summary ===`);
  log(`Bodies: ${targets.length}, Reports: ${totalReports}, Recommendations: ${totalRecs}, Errors: ${totalErrors}`);

  return results as Record<OversightBody, OversightIngestionResult>;
}


/**
 * Convenience: ingest OAG only.
 */
export async function ingestOAG(
  db: D1Database,
  options: Parameters<typeof ingestBody>[2] = {},
): Promise<OversightIngestionResult> {
  return ingestBody(db, 'OAG', options);
}

/**
 * Convenience: ingest PBO only.
 */
export async function ingestPBO(
  db: D1Database,
  options: Parameters<typeof ingestBody>[2] = {},
): Promise<OversightIngestionResult> {
  return ingestBody(db, 'PBO', options);
}

/**
 * Convenience: ingest Ethics Commissioner (CIEC) only.
 * Fetches and parses investigations into the Conflict of Interest Act.
 */
export async function ingestEthicsCommissioner(
  db: D1Database,
  options: Parameters<typeof ingestBody>[2] = {},
): Promise<OversightIngestionResult> {
  return ingestBody(db, 'EthicsCommissioner', options);
}

/**
 * Convenience: ingest Lobbying Commissioner (OCL) only.
 * Fetches and parses investigations into the Lobbying Act.
 */
export async function ingestLobbyingCommissioner(
  db: D1Database,
  options: Parameters<typeof ingestBody>[2] = {},
): Promise<OversightIngestionResult> {
  return ingestBody(db, 'LobbyingCommissioner', options);
}

/**
 * Convenience: ingest Competition Bureau only.
 * Fetches merger reviews, enforcement actions, and market studies.
 */
export async function ingestCompetitionBureau(
  db: D1Database,
  options: Parameters<typeof ingestBody>[2] = {},
): Promise<OversightIngestionResult> {
  return ingestBody(db, 'CompetitionBureau', options);
}

/**
 * Convenience: ingest CRTC only.
 * Fetches broadcasting and telecom regulatory decisions, including
 * media ownership change decisions.
 */
export async function ingestCRTC(
  db: D1Database,
  options: Parameters<typeof ingestBody>[2] = {},
): Promise<OversightIngestionResult> {
  return ingestBody(db, 'CRTC', options);
}

/**
 * Initialize oversight_investigations table if it doesn't exist.
 */
export async function initializeOversightInvestigationsTable(db: D1Database): Promise<void> {
  // Split the DDL into individual statements for compatibility
  const statements = OVERSIGHT_INVESTIGATIONS_DDL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    await db.exec(stmt + ';');
  }
}
