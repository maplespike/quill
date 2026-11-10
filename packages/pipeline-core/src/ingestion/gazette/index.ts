// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Gazette Ingestion — Quill
 *
 * Orchestrates the Canada Gazette ingestion pipeline:
 *   1. Fetch RSS feed for the specified Gazette part
 *   2. Parse RSS into GazetteRecord objects
 *   3. For each record, fetch the HTML detail page to extract:
 *      - Regulatory Impact Analysis Statement (RIAS) text and URL
 *      - Department name
 *      - Regulation ID
 *   4. Persist to D1 database (when available)
 *
 * News value:
 *   - Part I (proposed): Regulations published for 60-day public comment.
 *     High news value — journalists can report on what government PLANS
 *     to do BEFORE it happens.
 *   - Part II (enacted): Regulations that have become law. Contains SOR/2026-XXX
 *     registration numbers. Useful for tracking enacted regulatory changes.
 *
 * Designed to run as a cron job (daily) or ad-hoc via CLI.
 *
 * Architecture:
 *   - Single-part: ingestGazette()
 *   - All parts: ingestAllParts()
 */

import { fetchGazetteFeed, fetchRegulationDetail, GazetteFetchError } from './fetcher.js';
import { parseGazetteRSS, extractRIALink, extractDepartment, extractRIASText, extractRegulationId } from './parser.js';
import { GAZETTE_RSS_URLS, GAZETTE_DDL } from './constants.js';
import { GazettePart, type GazetteRecord, type GazetteIngestionResult } from './types.js';
import type { D1Database } from '../committees/db.js';


/**
 * Ingest new gazette records for a given Gazette part.
 *
 * Steps:
 *   1. Fetch the RSS feed for the given part
 *   2. Parse XML into GazetteRecord objects
 *   3. Fetch each regulation's HTML detail page to enrich with RIAS
 *   4. Persist to database (when db is provided)
 */
export async function ingestGazette(
  db: D1Database | null,
  part: GazettePart,
  options: {
    /** Only fetch the most recent N records */
    limit?: number;
    /** Re-fetch and re-parse already-ingested records */
    force?: boolean;
    /** Fetch regulation detail pages to extract RIAS (slower but richer) */
    fetchDetails?: boolean;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<GazetteIngestionResult> {
  const startTime = Date.now();
  const result: GazetteIngestionResult = {
    part,
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const fetchDetails = options.fetchDetails ?? true;

  // Create the table before any fetch work. initializeGazetteTable() had no
  // caller outside its own test, so gazette_records never existed and every
  // INSERT threw "no such table" — the run still reported success because the
  // per-record errors were collected, not raised. Fail the run instead of
  // reporting a green ingest that persisted nothing.
  if (db) {
    try {
      await initializeGazetteTable(db);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`gazette_records DDL: ${msg}`);
      log(`[Gazette ${part}] FATAL: cannot create gazette_records: ${msg}`);
      result.durationMs = Date.now() - startTime;
      return result;
    }
  }

  try {
    // Phase 1: Fetch RSS feed
    log(`[Gazette ${part}] Fetching RSS feed...`);
    const xml = await fetchGazetteFeed(part);
    const allRecords = await parseGazetteRSS(xml, part);
    result.recordsFound = allRecords.length;
    log(`[Gazette ${part}] Found ${allRecords.length} records in RSS feed`);

    if (allRecords.length === 0) {
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Apply limit
    const toProcess = options.limit
      ? allRecords.slice(0, options.limit)
      : allRecords;

    // Phase 2: Enrich with detail page data
    for (const record of toProcess) {
      try {
        if (fetchDetails) {
          log(`[Gazette ${part}] Fetching detail: ${record.title.substring(0, 60)}...`);
          const html = await fetchRegulationDetail(record.htmlUrl);

          // Extract RIAS link and text
          record.riasUrl = extractRIALink(html);
          record.riasText = extractRIASText(html);

          // Extract metadata
          record.department = extractDepartment(html);
          record.regulationId = extractRegulationId(html);
        }

        // Phase 3: Persist to database (when available)
        if (db) {
          await upsertGazetteRecord(db, record);
        }

        result.recordsIngested++;
        log(`[Gazette ${part}] ${record.title.substring(0, 60)}...` +
          (record.registrationNumber ? ` [${record.registrationNumber}]` : '') +
          (record.department ? ` (${record.department})` : ''));

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`"${record.title.substring(0, 60)}": ${msg}`);
        log(`[Gazette ${part}] ERROR: ${msg}`);
      }
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Gazette ${part}: ${msg}`);
    log(`[Gazette ${part}] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[Gazette ${part}] Done in ${result.durationMs}ms: ${result.recordsIngested}/${result.recordsFound} records` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));

  return result;
}


/**
 * Ingest ALL Gazette parts (I and II).
 * Part III (Acts) is deferred by default; its feed is `/rss/en-ls-eng.xml`
 * and it can be opted in with `parts: [GazettePart.I, II, III]`.
 *
 * Returns results keyed by part.
 */
export async function ingestAllParts(
  db: D1Database | null,
  options: {
    /** Only fetch the most recent N records per part */
    limit?: number;
    /** Re-fetch and re-parse already-ingested records */
    force?: boolean;
    /** Fetch regulation detail pages (slower but richer) */
    fetchDetails?: boolean;
    /** Gazette parts to ingest (default: [I, II]) */
    parts?: GazettePart[];
    /** Concurrency limit (default: 2 — sequential per part) */
    concurrency?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<Record<GazettePart, GazetteIngestionResult>> {
  const targets = options.parts ?? [GazettePart.I, GazettePart.II];
  const log = options.onProgress ?? (() => {});

  log(`=== Gazette Ingestion: ${targets.map(p => `Part ${p}`).join(', ')} ===`);

  const results: Record<GazettePart, GazetteIngestionResult> = {} as Record<GazettePart, GazetteIngestionResult>;

  // Process parts sequentially (each part has its own records to fetch & enrich)
  for (const part of targets) {
    const partResult = await ingestGazette(db, part, options);
    results[part] = partResult;
  }

  // Summary
  const totalFound = Object.values(results).reduce((s, r) => s + r.recordsFound, 0);
  const totalIngested = Object.values(results).reduce((s, r) => s + r.recordsIngested, 0);
  const totalErrors = Object.values(results).reduce((s, r) => s + r.errors.length, 0);
  log(`\\n=== Gazette Summary ===`);
  log(`Parts: ${targets.length}, Records: ${totalIngested}/${totalFound}, Errors: ${totalErrors}`);

  return results;
}


/**
 * Insert or ignore a gazette record in the D1 database.
 */
async function upsertGazetteRecord(
  db: D1Database,
  record: GazetteRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO gazette_records
      (id, title, html_url, part, published_at, description,
       registration_number, rias_url, rias_text, comment_deadline,
       department, regulation_id, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.title,
    record.htmlUrl,
    record.part,
    record.publishedAt,
    record.description,
    record.registrationNumber,
    record.riasUrl,
    record.riasText,
    record.commentDeadline,
    record.department,
    record.regulationId,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Initialize the gazette_records table.
 */
export async function initializeGazetteTable(db: D1Database): Promise<void> {
  await db.exec(GAZETTE_DDL);
}

/**
 * Get the latest publication date for a given Gazette part.
 * Useful for incremental ingestion.
 */
export async function getLatestPublicationDate(
  db: D1Database,
  part: GazettePart,
): Promise<string | null> {
  const row = await db.prepare(
    'SELECT published_at FROM gazette_records WHERE part = ? ORDER BY published_at DESC LIMIT 1',
  ).bind(part).first<{ published_at: string }>();
  return row?.published_at ?? null;
}

/**
 * Search gazette records by keyword in title or description.
 */
export async function searchGazetteRecords(
  db: D1Database,
  query: string,
  options: {
    part?: GazettePart;
    department?: string;
    limit?: number;
  } = {},
): Promise<GazetteRecord[]> {
  let sql = `
    SELECT * FROM gazette_records
    WHERE (title LIKE ? OR description LIKE ? OR department LIKE ?)
  `;
  const params: unknown[] = [`%${query}%`, `%${query}%`, `%${query}%`];

  if (options.part) {
    sql += ' AND part = ?';
    params.push(options.part);
  }

  if (options.department) {
    sql += ' AND department = ?';
    params.push(options.department);
  }

  sql += ' ORDER BY published_at DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<GazetteRecord>();
  return result.results ?? [];
}
