// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Qdrant Populator — Ingest → Qdrant Pipeline
 *
 * Reads ingested documents from D1/SQLite (via @maplespike/database),
 * chunks them, generates embeddings through the fusion gateway,
 * and upserts vectors into the Qdrant brain_wiki collection.
 *
 * Incremental mode: only re-indexes documents modified since the last
 * successful run by tracking last_indexed_at in a `pipeline_metadata` table.
 *
 * CLI usage:
 *   node dist/curation/qdrant-populator.js [--full]
 *
 * Or as a module:
 *   import { main, populate } from './curation/qdrant-populator.js';
 *   await populate();
 */

import { createLogger } from '../utils/logger.js';
import { QdrantEmbedder } from './embedder.js';
import type { EmbedderResult } from './embedder.js';

/* ------------------------------------------------------------------ */
/*  Logger                                                             */
/* ------------------------------------------------------------------ */

const log = createLogger('qdrant-populator');

/* ------------------------------------------------------------------ */
/*  Metadata Table Management                                          */
/* ------------------------------------------------------------------ */

const METADATA_TABLE = 'pipeline_metadata';

const ENSURE_METADATA_SQL = `
  CREATE TABLE IF NOT EXISTS ${METADATA_TABLE} (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

const GET_METADATA_SQL = `SELECT value FROM ${METADATA_TABLE} WHERE key = ?`;
const SET_METADATA_SQL = `
  INSERT OR REPLACE INTO ${METADATA_TABLE} (key, value, updated_at)
  VALUES (?, ?, datetime('now'))
`;

/**
 * Get the last successful run timestamp for a pipeline step.
 */
function getLastRunTimestamp(db: any, step: string): string | null {
  try {
    const row = db.prepare(GET_METADATA_SQL).get(`last_indexed_at_${step}`) as { value: string } | undefined;
    return row?.value ?? null;
  } catch (err) {
    log.warn(`Could not read last run timestamp: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Update the last successful run timestamp for a pipeline step.
 */
function setLastRunTimestamp(db: any, step: string, timestamp: string): void {
  try {
    db.prepare(SET_METADATA_SQL).run(`last_indexed_at_${step}`, timestamp);
    log.info(`Updated last_indexed_at_${step} = ${timestamp}`);
  } catch (err) {
    log.error(`Failed to set last run timestamp: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Table Discovery & Document Source Mapping                          */
/* ------------------------------------------------------------------ */

/**
 * Describes a source table that can be indexed into Qdrant.
 * Each table yields documents via a SELECT query.
 */
interface SourceTable {
  /** Name in the SQLite schema (e.g. 'contracts', 'lobbying_filings') */
  tableName: string;
  /** Human-readable source module name (e.g. 'contracts', 'lobbying') */
  sourceModule: string;
  /** Column name for the primary key / id */
  idColumn: string;
  /** Column name for the title / name */
  titleColumn: string;
  /** Column name for the main text body */
  textColumn: string;
  /** Column name for the source URL (optional) */
  urlColumn?: string;
  /** Column name for updated_at timestamp (used for incremental) */
  updatedAtColumn: string;
  /** Optional WHERE clause filter (e.g. to skip empty descriptions) */
  filterClause?: string;
}

const SOURCE_TABLES: SourceTable[] = [
  {
    tableName: 'contracts',
    sourceModule: 'contracts',
    idColumn: 'id',
    titleColumn: 'title',
    textColumn: 'description',
    urlColumn: 'source_url',   // stored in raw_data? — contracts have URLs in raw_data JSON
    updatedAtColumn: 'updated_at',
    filterClause: 'WHERE description IS NOT NULL AND description != \'\'',
  },
  {
    tableName: 'tenders',
    sourceModule: 'tenders',
    idColumn: 'id',
    titleColumn: 'title',
    textColumn: 'description',
    urlColumn: 'source_url',
    updatedAtColumn: 'updated_at',
    filterClause: 'WHERE description IS NOT NULL AND description != \'\'',
  },
  {
    tableName: 'lobbying_filings',
    sourceModule: 'lobbying',
    idColumn: 'id',
    titleColumn: 'registrant_name',
    textColumn: 'subject_matter',
    urlColumn: 'institution',
    updatedAtColumn: 'updated_at',
    filterClause: 'WHERE subject_matter IS NOT NULL AND subject_matter != \'\'',
  },
  {
    tableName: 'donations',
    sourceModule: 'donations',
    idColumn: 'id',
    titleColumn: 'recipient_name',
    textColumn: 'raw_data',
    updatedAtColumn: 'updated_at',
  },
  {
    tableName: 'disclosures',
    sourceModule: 'disclosures',
    idColumn: 'id',
    titleColumn: 'person_name',
    textColumn: 'position',
    urlColumn: 'source',
    updatedAtColumn: 'updated_at',
  },
  {
    tableName: 'gac_projects',
    sourceModule: 'gac-projects',
    idColumn: 'id',
    titleColumn: 'title',
    textColumn: 'description',
    urlColumn: 'source',
    updatedAtColumn: 'updated_at',
  },
  {
    tableName: 'organizations',
    sourceModule: 'organizations',
    idColumn: 'id',
    titleColumn: 'names',
    textColumn: 'raw_data',
    updatedAtColumn: 'updated_at',
    filterClause: 'WHERE raw_data IS NOT NULL AND raw_data != \'\'',
  },
  {
    tableName: 'persons',
    sourceModule: 'persons',
    idColumn: 'id',
    titleColumn: 'names',
    textColumn: 'raw_data',
    updatedAtColumn: 'updated_at',
  },
];

/**
 * Discover which source tables actually exist in the SQLite database.
 * We query sqlite_master to avoid errors on optional/missing tables.
 */
function discoverTables(db: any): SourceTable[] {
  const existing: SourceTable[] = [];
  for (const tbl of SOURCE_TABLES) {
    try {
      const row = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      ).get(tbl.tableName) as { name: string } | undefined;

      if (row) {
        existing.push(tbl);
        log.debug(`Found table: ${tbl.tableName}`);
      } else {
        log.debug(`Table not found (skipping): ${tbl.tableName}`);
      }
    } catch {
      log.debug(`Could not check table ${tbl.tableName} — skipping`);
    }
  }
  return existing;
}

/**
 * Extract a source URL from a raw_data JSON field, if available.
 */
function extractUrl(rawDataJson: string | null, urlColumn?: string): string {
  if (urlColumn && urlColumn !== 'source_url' && urlColumn !== 'source') {
    return '';
  }
  try {
    if (rawDataJson) {
      const parsed = JSON.parse(rawDataJson);
      return parsed.url || parsed.source_url || parsed.source || '';
    }
  } catch {
    // raw_data might not be valid JSON — that's okay
  }
  return '';
}

/**
 * Build a combined searchable text from a database row.
 * Combines title + description/body text for better semantic search.
 */
function buildDocumentText(
  title: string | null,
  body: string | null,
  rawData: string | null,
): string {
  const parts: string[] = [];
  if (title) parts.push(`Title: ${title}`);
  if (body) parts.push(`Body: ${body}`);
  if (rawData) {
    try {
      const parsed = JSON.parse(rawData);
      // Extract any meaningful string fields from raw_data
      for (const [key, val] of Object.entries(parsed)) {
        if (typeof val === 'string' && val.length > 20 && key !== 'url' && key !== 'source_url') {
          parts.push(`${key}: ${val}`);
        }
      }
    } catch {
      // Not JSON — skip
    }
  }
  return parts.join('\n\n');
}

/* ------------------------------------------------------------------ */
/*  Populate                                                           */
/* ------------------------------------------------------------------ */

export interface PopulateOptions {
  /** Force a full re-index, ignoring last_indexed_at */
  full?: boolean;
  /** Only process these source modules (comma-separated) */
  sources?: string;
  /** Override chunk size */
  chunkSize?: number;
  /** Override chunk overlap */
  chunkOverlap?: number;
}

export interface PopulateResult {
  totalIndexed: number;
  totalFailed: number;
  sourcesProcessed: number;
  durationMs: number;
  errors: string[];
}

/**
 * Main populate function.
 *
 * 1. Opens the SQLite database via @maplespike/database
 * 2. Ensures metadata table exists
 * 3. Discovers available source tables
 * 4. For each table: reads rows (incremental or full), chunks, embeds, upserts
 * 5. Updates last_indexed_at on success
 */
export async function populate(
  options: PopulateOptions = {},
): Promise<PopulateResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let totalIndexed = 0;
  let totalFailed = 0;

  // Dynamically import database — it uses better-sqlite3 (native module)
  let db: any | null = null;
  try {
    const { getRawDb, runMigrations } = await import('@maplespike/database');
    runMigrations();
    db = getRawDb();
    log.info('SQLite database connected');
  } catch (err) {
    const msg = `Failed to connect to database: ${err instanceof Error ? err.message : String(err)}`;
    log.error(msg);
    return {
      totalIndexed: 0,
      totalFailed: 0,
      sourcesProcessed: 0,
      durationMs: Date.now() - startTime,
      errors: [msg],
    };
  }

  // Ensure metadata table exists
  db.exec(ENSURE_METADATA_SQL);

  // Discover tables
  const tables = discoverTables(db);
  if (tables.length === 0) {
    log.warn('No source tables found in database — nothing to index');
    return {
      totalIndexed: 0,
      totalFailed: 0,
      sourcesProcessed: 0,
      durationMs: Date.now() - startTime,
      errors: [],
    };
  }

  // Parse source filter
  const sourceFilter = options.sources
    ? new Set(options.sources.split(',').map(s => s.trim()))
    : null;

  // Filter tables
  const activeTables = sourceFilter
    ? tables.filter(t => sourceFilter.has(t.sourceModule))
    : tables;

  log.info(`Processing ${activeTables.length} source tables (${tables.length} available)`);

  // Create embedder
  const embedder = new QdrantEmbedder({
    chunkSize: options.chunkSize || 512,
    chunkOverlap: options.chunkOverlap || 64,
  });

  let sourcesProcessed = 0;

  for (const table of activeTables) {
    try {
      const result = await processTable(db, embedder, table, options.full ?? false);
      totalIndexed += result.indexedCount;
      totalFailed += result.failedCount;
      sourcesProcessed++;

      log.info(
        `Table "${table.tableName}": ${result.indexedCount} indexed, ${result.failedCount} failed in ${result.durationMs}ms`,
      );
    } catch (err) {
      const msg = `Table "${table.tableName}" failed: ${err instanceof Error ? err.message : String(err)}`;
      log.error(msg);
      errors.push(msg);
    }
  }

  const durationMs = Date.now() - startTime;
  log.info(`Populate complete: ${totalIndexed} indexed, ${totalFailed} failed across ${sourcesProcessed} sources in ${durationMs}ms`);

  return { totalIndexed, totalFailed, sourcesProcessed, durationMs, errors };
}

/**
 * Process all records from a single source table.
 */
async function processTable(
  db: any,
  embedder: QdrantEmbedder,
  table: SourceTable,
  fullReindex: boolean,
): Promise<EmbedderResult> {
  const stepName = `table_${table.tableName}`;

  // Incremental: get last run timestamp
  let lastIndexedAt: string | null = null;
  if (!fullReindex) {
    lastIndexedAt = getLastRunTimestamp(db, stepName);
  }

  const whereClause = table.filterClause || '';
  const incrementalClause = lastIndexedAt
    ? `${whereClause ? `${whereClause} AND` : 'WHERE'} ${table.updatedAtColumn} > ?`
    : whereClause;

  // Count total rows to process
  const countSql = `SELECT COUNT(*) as cnt FROM ${table.tableName} ${incrementalClause}`;
  const countParams = lastIndexedAt ? [lastIndexedAt] : [];
  const countRow = db.prepare(countSql).get(...countParams) as { cnt: number };
  const totalRows = countRow?.cnt ?? 0;

  if (totalRows === 0) {
    log.info(`Table "${table.tableName}": no new/modified rows to index`);
    return { indexedCount: 0, failedCount: 0, durationMs: 0 };
  }

  log.info(`Table "${table.tableName}": processing ${totalRows} rows`);

  const startTime = Date.now();
  let indexedCount = 0;
  let failedCount = 0;

  // Fetch rows in pages to avoid loading everything into memory
  const pageSize = 50;
  let offset = 0;

  // Build column list dynamically
  const columns = [table.idColumn, table.titleColumn, table.textColumn, table.updatedAtColumn];
  if (table.textColumn !== 'raw_data') {
    columns.push('raw_data');
  }
  const selectSql = `SELECT ${columns.join(', ')} FROM ${table.tableName} ${incrementalClause} LIMIT ? OFFSET ?`;

  while (offset < totalRows) {
    const params = lastIndexedAt ? [lastIndexedAt, pageSize, offset] : [pageSize, offset];
    const rows = db.prepare(selectSql).all(...params) as Array<Record<string, unknown>>;

    for (const row of rows) {
      try {
        const title = String(row[table.titleColumn] ?? '');
        const body = String(row[table.textColumn] ?? '');
        const rawData = row['raw_data'] as string | null ?? null;

        const docText = buildDocumentText(
          title,
          table.textColumn === 'raw_data' ? null : body,
          table.textColumn === 'raw_data' ? body : rawData,
        );

        if (!docText.trim()) continue;

        const sourceUrl = table.textColumn === 'raw_data'
          ? extractUrl(body, table.urlColumn)
          : extractUrl(rawData, table.urlColumn);

        const result = await embedder.processDocument(docText, {
          source: table.sourceModule,
          sourceUrl: sourceUrl || `${table.tableName}/${String(row[table.idColumn])}`,
          chunkText: docText.slice(0, 200),
          chunkIndex: 0,
        });

        indexedCount += result.indexedCount;
        failedCount += result.failedCount;
      } catch (rowErr) {
        failedCount++;
        log.error(`Row ${String(row[table.idColumn])} in ${table.tableName}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`);
      }
    }

    offset += pageSize;
  }

  // Update the last_indexed_at timestamp
  setLastRunTimestamp(db, stepName, new Date().toISOString());

  return {
    indexedCount,
    failedCount,
    durationMs: Date.now() - startTime,
  };
}

/* ------------------------------------------------------------------ */
/*  CLI Entry Point                                                    */
/* ------------------------------------------------------------------ */

/**
 * CLI main entry. Call via `node dist/curation/qdrant-populator.js`.
 *
 * Flags:
 *   --full        Force full re-index, ignoring last_indexed_at
 *   --sources=    Comma-separated list of source modules (e.g. "contracts,lobbying")
 *   --chunk-size= Override default chunk size (default: 512)
 *   --chunk-overlap= Override default chunk overlap (default: 64)
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const sourcesFlag = args.find(a => a.startsWith('--sources='));
  const chunkSizeFlag = args.find(a => a.startsWith('--chunk-size='));
  const chunkOverlapFlag = args.find(a => a.startsWith('--chunk-overlap='));

  const options: PopulateOptions = {
    full,
    sources: sourcesFlag?.split('=')[1],
    chunkSize: chunkSizeFlag ? parseInt(chunkSizeFlag.split('=')[1], 10) : undefined,
    chunkOverlap: chunkOverlapFlag ? parseInt(chunkOverlapFlag.split('=')[1], 10) : undefined,
  };

  log.info('Starting Qdrant populator...');
  log.info(`Options: full=${options.full}, sources=${options.sources || 'all'}`);

  try {
    const result = await populate(options);

    if (result.errors.length > 0) {
      log.error(`Completed with ${result.errors.length} error(s):`);
      for (const err of result.errors) {
        log.error(`  - ${err}`);
      }
    }

    log.info(
      `Result: ${result.totalIndexed} indexed, ${result.totalFailed} failed, ` +
      `${result.sourcesProcessed} sources processed in ${result.durationMs}ms`,
    );

    process.exit(result.errors.length > 0 ? 1 : 0);
  } catch (err) {
    log.error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// Allow direct CLI invocation
const isMain = process.argv[1]?.endsWith('qdrant-populator.js')
  || process.argv[1]?.endsWith('qdrant-populator.ts');
if (isMain) {
  main().catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
}

export default { main, populate };
