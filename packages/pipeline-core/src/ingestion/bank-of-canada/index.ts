/**
 * Bank of Canada Ingestion Module — Quill
 *
 * Orchestrates the ingestion pipeline for Bank of Canada data:
 *   - Interest rate decisions (overnight rate target)
 *   - Monetary Policy Reports (MPR)
 *   - Financial System Reviews (FSR)
 *   - VALA executive speeches
 *
 * Pipeline:
 *   1. Fetch rate decisions from RSS feed
 *   2. Fetch MPR and FSR publications from listing pages
 *   3. Fetch VALA executive speeches
 *   4. Fetch detail pages for deep metadata extraction
 *   5. Parse into structured BocDecision records
 *   6. Persist to D1 database
 *
 * Key data for monetary policy tracking:
 *   - Rate decisions reveal the Bank's inflation fight trajectory
 *   - MPRs provide the economic outlook and inflation forecasts
 *   - FSRs assess financial system vulnerabilities
 *   - Executive speeches offer forward guidance and policy signals
 */

import { fetchAllBocData, fetchDetailPages, BocFetchError } from './fetcher.js';
import { parseBocDecisionList, createIngestionResult } from './parser.js';
import type {
  BocDecision,
  BocDecisionType,
  BocIngestionResult,
  RawBocItem,
} from './types.js';
import type { D1Database } from '../oversight/index.js';


/* ------------------------------------------------------------------ */
/*  BOC DDL Statements for Schema                                      */
/* ------------------------------------------------------------------ */

export const BOC_DECISIONS_DDL = `-- Bank of Canada decisions and publications
CREATE TABLE IF NOT EXISTS boc_decisions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('rate','mpr','fsr','speech')),
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT NOT NULL,
  key_rate TEXT,
  effective_date TEXT,
  speaker TEXT,
  speaker_title TEXT,
  event TEXT,
  pdf_url TEXT,
  language TEXT DEFAULT 'en',
  ingested_at TEXT NOT NULL,
  UNIQUE(url)
);

CREATE INDEX IF NOT EXISTS idx_boc_date ON boc_decisions(date DESC);
CREATE INDEX IF NOT EXISTS idx_boc_type ON boc_decisions(type);
CREATE INDEX IF NOT EXISTS idx_boc_type_date ON boc_decisions(type, date DESC);
CREATE INDEX IF NOT EXISTS idx_boc_key_rate ON boc_decisions(key_rate);
CREATE INDEX IF NOT EXISTS idx_boc_speaker ON boc_decisions(speaker);
CREATE INDEX IF NOT EXISTS idx_boc_ingested ON boc_decisions(ingested_at DESC);`;


/* ------------------------------------------------------------------ */
/*  Database Helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Initialize the boc_decisions table in the database.
 */
export async function initializeBocTable(db: D1Database): Promise<void> {
  await db.exec(BOC_DECISIONS_DDL);
}

/**
 * Check if the boc_decisions table exists.
 */
export async function bocTableExists(db: D1Database): Promise<boolean> {
  try {
    const result = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='boc_decisions'",
    ).first();
    return result !== null;
  } catch {
    return false;
  }
}

/**
 * Insert or ignore a Bank of Canada decision record.
 */
async function upsertDecision(db: D1Database, decision: BocDecision): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO boc_decisions
      (id, date, type, title, summary, url,
       key_rate, effective_date, speaker, speaker_title, event,
       pdf_url, language, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    decision.id,
    decision.date,
    decision.type,
    decision.title,
    decision.summary,
    decision.url,
    decision.keyRate,
    decision.effectiveDate,
    decision.speaker,
    decision.speakerTitle,
    decision.event,
    decision.pdfUrl,
    decision.language,
    decision.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Check if a decision already exists by URL.
 */
async function decisionExists(db: D1Database, url: string): Promise<boolean> {
  const row = await db.prepare(
    'SELECT 1 FROM boc_decisions WHERE url = ? LIMIT 1',
  ).bind(url).first();
  return row !== null;
}

/**
 * Get the latest decision date for incremental ingestion.
 */
export async function getLatestBocDate(
  db: D1Database,
  type?: BocDecisionType,
): Promise<string | null> {
  let sql = 'SELECT date FROM boc_decisions';
  const params: string[] = [];

  if (type) {
    sql += ' WHERE type = ?';
    params.push(type);
  }

  sql += ' ORDER BY date DESC LIMIT 1';

  const row = await db.prepare(sql).bind(...params).first<{ date: string }>();
  return row?.date ?? null;
}


/* ------------------------------------------------------------------ */
/*  Main Ingestion Function                                            */
/* ------------------------------------------------------------------ */

/**
 * Ingest Bank of Canada rate decisions, publications, and speeches.
 *
 * Pipeline:
 *   1. Fetch all data from RSS feeds and listing pages
 *   2. Optionally fetch detail pages for deep metadata
 *   3. Parse into BocDecision records
 *   4. Persist to D1 database
 *
 * @param db - D1 database instance
 * @param options - Ingestion options
 * @returns Ingestion result summary
 */
export async function ingestBankOfCanada(
  db: D1Database,
  options: {
    /** Also fetch detail pages for deep parsing */
    fetchDetails?: boolean;
    /** Force re-ingestion of existing records */
    force?: boolean;
    /** Max RSS items per feed */
    maxRssItems?: number;
    /** Years of historical data to fetch */
    historicalYears?: number;
    /** Include rate decisions (default: true) */
    includeRates?: boolean;
    /** Include MPR publications (default: true) */
    includeMpr?: boolean;
    /** Include FSR publications (default: true) */
    includeFsr?: boolean;
    /** Include executive speeches (default: true) */
    includeSpeeches?: boolean;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<BocIngestionResult> {
  const startTime = Date.now();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];
  const sourcesTried: string[] = [];

  log('[BoC] Starting Bank of Canada ingestion...');

  // Phase 1: Initialize table if needed
  try {
    const tableExists = await bocTableExists(db);
    if (!tableExists) {
      log('[BoC] Initializing boc_decisions table...');
      await initializeBocTable(db);
    }
  } catch (err) {
    errors.push(`Table init: ${err instanceof Error ? err.message : String(err)}`);
    return createIngestionResult({ errors, startTime });
  }

  // Phase 2: Fetch all Bank of Canada data
  log('[BoC] Fetching Bank of Canada data...');
  let rawItems: RawBocItem[] = [];
  try {
    const result = await fetchAllBocData({
      maxRssItems: options.maxRssItems ?? 50,
      historicalYears: options.historicalYears ?? 5,
    });

    rawItems = result.decisions;
    sourcesTried.push(...result.sourcesTried);
    errors.push(...result.errors);
    log(`[BoC] Found ${rawItems.length} items from ${result.sourcesTried.length} sources`);
  } catch (err) {
    errors.push(`Fetch phase: ${err instanceof Error ? err.message : String(err)}`);
    log(`[BoC] FATAL fetch error: ${err instanceof Error ? err.message : String(err)}`);
    return createIngestionResult({ errors, sourcesTried, startTime });
  }

  if (rawItems.length === 0) {
    log('[BoC] No items found');
    return createIngestionResult({
      decisionsFound: 0,
      sourcesTried,
      errors,
      startTime,
    });
  }

  // Filter by included types if specified
  if (options.includeRates === false || options.includeMpr === false ||
      options.includeFsr === false || options.includeSpeeches === false) {
    rawItems = rawItems.filter(item => {
      const type = classifyRawType(item);
      if (type === 'rate' && options.includeRates === false) return false;
      if (type === 'mpr' && options.includeMpr === false) return false;
      if (type === 'fsr' && options.includeFsr === false) return false;
      if (type === 'speech' && options.includeSpeeches === false) return false;
      return true;
    });
    log(`[BoC] After type filter: ${rawItems.length} items`);
  }

  // Phase 3: Optionally fetch detail pages
  let detailPages = new Map<string, string>();
  if (options.fetchDetails) {
    log('[BoC] Fetching detail pages...');
    try {
      detailPages = await fetchDetailPages(rawItems);
      log(`[BoC] Fetched ${detailPages.size} detail pages`);
    } catch (err) {
      errors.push(`Detail fetch: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Phase 4: Parse items
  log('[BoC] Parsing items...');
  const decisions = await parseBocDecisionList(rawItems, {
    detailPages,
    onProgress: log,
  });
  log(`[BoC] Parsed ${decisions.length} decisions/publications`);

  // Phase 5: Persist to database
  log('[BoC] Persisting to database...');
  let decisionsIngested = 0;
  for (const decision of decisions) {
    try {
      // Skip if already exists (unless force)
      if (!options.force) {
        const exists = await decisionExists(db, decision.url);
        if (exists) continue;
      }

      await upsertDecision(db, decision);
      decisionsIngested++;
    } catch (err) {
      errors.push(`Insert ${decision.type} ${decision.title?.substring(0, 50)}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  log(`[BoC] Persisted ${decisionsIngested} new items`);

  // Build result
  const result: BocIngestionResult = {
    decisionsFound: rawItems.length,
    decisionsIngested,
    sourcesTried,
    errors,
    durationMs: Date.now() - startTime,
  };

  log(`[BoC] Done in ${result.durationMs}ms: ${result.decisionsIngested} items ingested` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));

  return result;
}

/**
 * Classify a raw item's type early for filtering.
 */
function classifyRawType(item: RawBocItem): string {
  return item.rawType || 'rate';
}


/* ------------------------------------------------------------------ */
/*  Query Functions                                                    */
/* ------------------------------------------------------------------ */

/**
 * Search Bank of Canada decisions by various criteria.
 */
export async function searchBocDecisions(
  db: D1Database,
  query: string,
  options: {
    type?: BocDecisionType;
    limit?: number;
  } = {},
): Promise<BocDecision[]> {
  let sql = `
    SELECT * FROM boc_decisions
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      title LIKE ? OR
      summary LIKE ? OR
      speaker LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q);
  }

  if (options.type) {
    sql += ' AND type = ?';
    params.push(options.type);
  }

  sql += ' ORDER BY date DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<BocDecision>();
  return result.results ?? [];
}

/**
 * Get recent Bank of Canada decisions.
 */
export async function getRecentBocDecisions(
  db: D1Database,
  limit: number = 20,
  type?: BocDecisionType,
): Promise<BocDecision[]> {
  let sql = 'SELECT * FROM boc_decisions';
  const params: unknown[] = [];

  if (type) {
    sql += ' WHERE type = ?';
    params.push(type);
  }

  sql += ' ORDER BY date DESC LIMIT ?';
  params.push(limit);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<BocDecision>();
  return result.results ?? [];
}

/**
 * Get rate decisions with key rate changes.
 */
export async function getBocRateChanges(
  db: D1Database,
  limit: number = 20,
): Promise<BocDecision[]> {
  const sql = `
    SELECT * FROM boc_decisions
    WHERE type = 'rate' AND key_rate IS NOT NULL
    ORDER BY date DESC
    LIMIT ?
  `;
  const stmt = db.prepare(sql).bind(limit);
  const result = await stmt.all<BocDecision>();
  return result.results ?? [];
}

/**
 * Get Bank of Canada decisions by date range.
 */
export async function getBocByDateRange(
  db: D1Database,
  startDate: string,
  endDate: string,
  type?: BocDecisionType,
): Promise<BocDecision[]> {
  let sql = `
    SELECT * FROM boc_decisions
    WHERE date >= ? AND date <= ?
  `;
  const params: unknown[] = [startDate, endDate];

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  sql += ' ORDER BY date DESC';

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<BocDecision>();
  return result.results ?? [];
}

/**
 * Get speeches by a specific Bank of Canada executive.
 */
export async function getBocSpeechesBySpeaker(
  db: D1Database,
  speaker: string,
  limit: number = 20,
): Promise<BocDecision[]> {
  const sql = `
    SELECT * FROM boc_decisions
    WHERE type = 'speech' AND speaker LIKE ?
    ORDER BY date DESC
    LIMIT ?
  `;
  const stmt = db.prepare(sql).bind(`%${speaker}%`, limit);
  const result = await stmt.all<BocDecision>();
  return result.results ?? [];
}
