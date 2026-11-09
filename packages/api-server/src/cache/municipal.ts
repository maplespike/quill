/**
 * Quill — Municipal Records Cache
 *
 * Persistent SQLite-backed cache of successfully-fetched municipal records.
 * The route layer at `/v1/municipal*` writes here at the end of every
 * successful ingest, and reads here as a fallback when upstream CKAN /
 * Socrata portals return 403 (Cloudflare bot-block) or 5xx.
 *
 * Why this exists:
 *   Some municipal portals (notably Toronto, Hamilton, Mississauga,
 *   Vancouver, Brampton) Cloudflare-bot-block the test egress IP. Their
 *   primary endpoints return `provenance.status: "unavailable"`. The cache
 *   here lets the route layer return records with
 *   `provenance.status: "cached"` plus freshness metadata — the API keeps
 *   delivering data even when upstream is evasive.
 *
 * Cache strategy:
 *   - One row per (city_id, dataset). Upsert on every successful fetch.
 *   - Schema migrates lazily on the first write (`CREATE TABLE IF NOT EXISTS`).
 *     Readers do not create the table: DDL takes the write lock.
 *   - Reads are cheap; no TTL — staleness is reported honestly via
 *     `age_seconds` in the response envelope.
 *
 * Storage:
 *   - Uses Node's built-in `node:sqlite` (no native compile, no extra deps).
 *   - Opens the same DB file as the main QuillStorage backend
 *     (`process.env.QUILL_DB_PATH` or per-mode default). Both backends
 *     (better-sqlite3 / node:sqlite) write to the same file in WAL mode,
 *     so cross-process reads are safe.
 *   - If DB is unreachable (D1 / Memory / no QUILL_DB_PATH), all helpers
 *     return null / empty arrays — degrades gracefully to the cache-less
 *     behaviour already proven in the route layer.
 *
 * Connection strategy:
 *   Writers and readers never share a connection. A shared connection that
 *   is already inside a transaction keeps the pre-transaction snapshot, so
 *   a later SELECT misses rows another connection has committed, and an
 *   upgrade from that read to a write throws SQLITE_BUSY immediately.
 *   Each call opens its own `DatabaseSync` and closes it in `finally`.
 *   Readers open read-only, set `busy_timeout`, and only SELECT. They do
 *   not run DDL and they do not checkpoint: both take a write lock and
 *   turn a concurrent writer into `database is locked`, which the old
 *   code swallowed as an empty cache miss (the Toronto cache-fallback flake).
 *   Writers enable WAL, use `synchronous=NORMAL`, and take the write lock
 *   with `BEGIN IMMEDIATE` so they never promote a deferred read into a
 *   snapshot conflict. Lock conflicts retry until `BUSY_TIMEOUT_MS`.
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';

const SCHEMA_VERSION = 1 as const;

/** How long a writer retries, and how long a reader waits, when the file is locked. */
const BUSY_TIMEOUT_MS = 5_000;

/**
 * One-slot pause between writer retries. `Atomics.wait` yields the thread
 * so the connection that holds the lock can commit. A C-level
 * `busy_timeout` on the writer would sleep inside `BEGIN IMMEDIATE` and
 * the retry could not roll the transaction back first.
 */
const writerYield = new Int32Array(new SharedArrayBuffer(4));

/**
 * Test barrier. Invoked once when a cache write observes `SQLITE_BUSY`.
 * Production leaves this unset. The regression test uses it to release
 * the other writer without sleeping.
 */
let onWriteLockBusy: (() => void) | undefined;

export function setMunicipalCacheWriteLockHook(hook: (() => void) | undefined): void {
  onWriteLockBusy = hook;
}

function isLockedError(err: unknown): boolean {
  const code = typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code?: unknown }).code)
    : '';
  const msg = err instanceof Error ? err.message : String(err);
  return code === 'SQLITE_BUSY' || /database is locked|database is busy|SQLITE_BUSY/i.test(msg);
}

function isMissingTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no such table/i.test(msg);
}

function rollbackQuiet(db: DatabaseSync): void {
  try { db.exec('ROLLBACK'); } catch { /* autocommit — nothing to roll back */ }
}

function closeQuiet(db: DatabaseSync | undefined): void {
  try { db?.close(); } catch { /* ignore */ }
}

/** Schema bootstrap + WAL pragma. Idempotent — re-runs cheaply. */
function bootstrapCacheSchema(db: DatabaseSync): void {
  db.exec(`PRAGMA journal_mode = WAL`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS municipal_records_cache (
      schema_version INTEGER NOT NULL DEFAULT ${SCHEMA_VERSION},
      city_id TEXT NOT NULL,
      dataset TEXT NOT NULL,
      source TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      records_json TEXT NOT NULL,
      succeeded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      PRIMARY KEY (city_id, dataset)
    );
    CREATE INDEX IF NOT EXISTS idx_municipal_cache_city ON municipal_records_cache(city_id);
    CREATE INDEX IF NOT EXISTS idx_municipal_cache_age ON municipal_records_cache(succeeded_at DESC);
  `);
}

function dbPathIfPresent(): string | null {
  const dbPath = process.env.QUILL_DB_PATH;
  if (!dbPath || !existsSync(dbPath)) return null;
  return dbPath;
}

/** Read-only handle. No DDL and no checkpoint, so a writer can commit beside it. */
function openReader(dbPath: string): DatabaseSync {
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true, timeout: BUSY_TIMEOUT_MS });
    db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    return db;
  } catch {
    // Read-only open fails before the file is a database, or when this
    // build of node:sqlite cannot attach a WAL shm read-only. Fall back
    // to a read-write connection that still refuses writes (`query_only`)
    // after WAL is on.
    const db = new DatabaseSync(dbPath, { timeout: BUSY_TIMEOUT_MS });
    db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    const mode = db.prepare('PRAGMA journal_mode').get() as { journal_mode?: string } | undefined;
    if (mode?.journal_mode !== 'wal') {
      db.exec('PRAGMA journal_mode = WAL');
      db.exec('PRAGMA synchronous = NORMAL');
    }
    db.exec('PRAGMA query_only = ON');
    return db;
  }
}

function withCacheReader<T>(cb: (db: DatabaseSync) => T): T | null {
  const dbPath = dbPathIfPresent();
  if (!dbPath) return null;
  let db: DatabaseSync | undefined;
  try {
    db = openReader(dbPath);
    return cb(db);
  } catch (err) {
    if (isMissingTable(err) || isLockedError(err)) return null;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[MunicipalCache] read failed: ${msg}`);
    return null;
  } finally {
    closeQuiet(db);
  }
}

function applyWriterPragmas(db: DatabaseSync): void {
  // 0 here on purpose. The retry loop below owns the wait. A non-zero
  // busy_timeout would block inside BEGIN and skip the rollback between tries.
  db.exec('PRAGMA busy_timeout = 0');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  bootstrapCacheSchema(db);
}

/**
 * Run `fn` inside `BEGIN IMMEDIATE` on a fresh writer connection.
 * Retries when another connection holds the write lock. Returns without
 * throwing when the database file is not configured. Throws when the
 * statement fails for a reason other than the lock, or when the lock
 * outlasts `BUSY_TIMEOUT_MS`.
 */
function withCacheWrite(fn: (db: DatabaseSync) => void): void {
  const dbPath = dbPathIfPresent();
  if (!dbPath) return;
  const deadline = Date.now() + BUSY_TIMEOUT_MS;
  let notified = false;
  let lastLock: unknown;
  while (Date.now() <= deadline) {
    const db = new DatabaseSync(dbPath, { timeout: 0 });
    try {
      applyWriterPragmas(db);
      rollbackQuiet(db);
      db.exec('BEGIN IMMEDIATE');
      try {
        fn(db);
        db.exec('COMMIT');
        return;
      } catch (err) {
        rollbackQuiet(db);
        throw err;
      }
    } catch (err) {
      if (!isLockedError(err)) throw err;
      lastLock = err;
      if (!notified) {
        notified = true;
        try { onWriteLockBusy?.(); } catch { /* the hook must not mask the write */ }
      }
      Atomics.wait(writerYield, 0, 0, 1);
    } finally {
      closeQuiet(db);
    }
  }
  const msg = lastLock instanceof Error ? lastLock.message : 'database is locked';
  throw new Error(`municipal cache write timed out waiting for the SQLite lock: ${msg}`);
}

export interface CachedMunicipalFetch {
  cityId: string;
  dataset: string;
  source: string;
  recordCount: number;
  records: Array<Record<string, unknown>>;
  succeededAt: string;
}

/**
 * Persist a successful (city_id, dataset) fetch. Upserts — most-recent
 * successful fetch wins. Silent no-op when DB isn't reachable.
 *
 * Records passed in MUST be JSON-serialisable plain objects (which the
 * route layer's `UnifiedMunicipalRecord` shape is — after we strip the
 * per-call `provenance` block, which contains the policy hash and would
 * drift across runs).
 */
export function saveMunicipalRecordCache(
  cityId: string,
  dataset: string,
  source: string,
  records: Array<Record<string, unknown>>,
): void {
  // Strip the per-call provenance block before serialising — citation_hash
  // includes fetched_at which isn't a cache-stable property.
  const stripped = records.map((r) => {
    const { provenance, ...rest } = r as { provenance?: unknown };
    void provenance;
    return rest;
  });
  try {
    withCacheWrite((db) => {
      db.prepare(`
        INSERT INTO municipal_records_cache (schema_version, city_id, dataset, source, record_count, records_json)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(city_id, dataset) DO UPDATE SET
          source = excluded.source,
          record_count = excluded.record_count,
          records_json = excluded.records_json,
          succeeded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `).run(
        SCHEMA_VERSION,
        cityId,
        dataset,
        source,
        records.length,
        JSON.stringify(stripped),
      );
      // Keep the FTS5 index (gh #794) warm at write time; the search path
      // also self-heals, but doing it here means the first search after an
      // ingest doesn't have to re-index the row.
      try { syncSearchIndex(db); } catch { /* index unavailable - search degrades */ }
    });
  } catch (err) {
    // best-effort - never break the request path over a cache write.
    // Lock contention is retried inside withCacheWrite; this catch is the
    // corrupt-database and timeout path.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[MunicipalCache] saveMunicipalRecordCache failed for ${cityId}/${dataset}: ${msg}`);
  }
}

/**
 * Read the most-recent successful fetch for a (city, dataset) pair.
 * Returns null when no cache entry exists OR DB is unreachable.
 *
 * If the entry is older than QUILL_MUNICIPAL_CACHE_MAX_AGE_SEC (default
 * 7 days), it's treated as expired and returns null so the caller falls
 * through to `unavailable`. Configurable so cron-driven cache re-validation
 * can tighten or loosen this without code change.
 *
 * A concurrent writer does not hide a committed row. The reader uses its
 * own connection in WAL mode, so it sees the latest commit without waiting
 * for the writer to close and without checkpointing the WAL.
 */
export function loadMunicipalRecordCache(
  cityId: string,
  dataset: string,
): CachedMunicipalFetch | null {
  const result = withCacheReader<CachedMunicipalFetch | null>((db) => {
    try {
      const rows = db.prepare(`
        SELECT city_id, dataset, source, record_count, records_json, succeeded_at
        FROM municipal_records_cache
        WHERE city_id = ? AND dataset = ?
      `).all(cityId, dataset) as Array<{
        city_id: string;
        dataset: string;
        source: string;
        record_count: number;
        records_json: string;
        succeeded_at: string;
      }>;
      const row = rows[0];
      if (!row) return null;

      // Max-age gate — protects against serving indefinitely-stale data when
      // a city's portal quietly changes schema. Default 7 days. Operators on
      // tight SLAs can tighten to 24h via env var.
      const maxAgeSec = parseInt(process.env.QUILL_MUNICIPAL_CACHE_MAX_AGE_SEC ?? '604800', 10);
      const ageMs = Date.now() - new Date(row.succeeded_at).getTime();
      if (Number.isFinite(maxAgeSec) && maxAgeSec > 0 && ageMs / 1000 > maxAgeSec) {
        return null;
      }

      return {
        cityId: row.city_id,
        dataset: row.dataset,
        source: row.source,
        recordCount: row.record_count,
        records: JSON.parse(row.records_json) as Array<Record<string, unknown>>,
        succeededAt: row.succeeded_at,
      };
    } catch (err) {
      if (isMissingTable(err) || isLockedError(err)) return null;
      // If a row's records_json got corrupted (manual SQL poke, schema
      // migration mishap, disk fault) we land here. Log loudly so operators
      // know WHY the route returned unavailable — silent null would just look
      // like "no cache present yet" forever.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[MunicipalCache] loadMunicipalRecordCache failed for ${cityId}/${dataset}: ${msg}`);
      return null;
    }
  });
  return result ?? null;
}

// ---------------------------------------------------------------------------
// FTS5 full-text index over cached records (gh issue #794)
//
// The index is DERIVED state: one FTS5 row per cached record, keyed by
// (city_id, dataset, record_index) with the record's JSON text as the
// searchable body. Two tables back it:
//
//   municipal_records_fts   — FTS5 virtual table (bm25/token matching)
//   municipal_search_sync   — (city_id, dataset) -> succeeded_at watermark of
//                             the cache row that was last indexed
//
// Synchronisation is lazy and self-healing: every search (and every cache
// write) re-scans `municipal_records_cache` and re-indexes only the rows whose
// `succeeded_at` watermark moved, plus purges index rows for deleted cache
// rows. That keeps the index correct even when rows are written by a
// different process (cron sweep, manual SQL poke) that never calls the
// save helper. Cost is a metadata scan over ~dozens of rows per search.
// ---------------------------------------------------------------------------

/** One indexed record — the canonical search sort key. */
export interface MunicipalSearchHit {
  cityId: string;
  dataset: string;
  recordIndex: number;
}

/**
 * Turn free-text user input into an FTS5 MATCH expression.
 *
 * Only word/number runs are kept and each is quoted, joined with implicit
 * AND. That is deliberate:
 *   - user input can never inject FTS5 syntax (quotes, `*`, `-`, parens),
 *   - matching is TOKEN-based, not substring-based ("rating" no longer
 *     matches "Operating"), which is the point of moving off `includes()`.
 * Returns null when the query has no searchable tokens.
 */
export function toFtsMatchQuery(query: string): string | null {
  const tokens = query.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!tokens || tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"`).join(' ');
}

/** Idempotent DDL for the FTS5 index + its sync watermark table. */
function bootstrapSearchSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS municipal_search_sync (
      city_id TEXT NOT NULL,
      dataset TEXT NOT NULL,
      succeeded_at TEXT NOT NULL,
      PRIMARY KEY (city_id, dataset)
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS municipal_records_fts USING fts5(
      city_id UNINDEXED,
      dataset UNINDEXED,
      record_index UNINDEXED,
      body
    );
  `);
}

/**
 * Bring the FTS5 index in line with `municipal_records_cache`. Only rows whose
 * `succeeded_at` differs from the recorded watermark are (re)indexed, so a
 * steady-state search does zero writes. Throws on FTS5-unavailable SQLite
 * builds; callers treat that as "index unavailable" and degrade.
 */
function syncSearchIndex(db: DatabaseSync): void {
  bootstrapSearchSchema(db);

  const cacheRows = db.prepare(`
    SELECT city_id, dataset, records_json, succeeded_at
    FROM municipal_records_cache
  `).all() as Array<{
    city_id: string;
    dataset: string;
    records_json: string;
    succeeded_at: string;
  }>;

  const watermarks = new Map<string, string>();
  for (const row of db.prepare(`SELECT city_id, dataset, succeeded_at FROM municipal_search_sync`).all() as Array<{
    city_id: string; dataset: string; succeeded_at: string;
  }>) {
    watermarks.set(`${row.city_id}\u0000${row.dataset}`, row.succeeded_at);
  }

  const delIndex = db.prepare(`DELETE FROM municipal_records_fts WHERE city_id = ? AND dataset = ?`);
  const insertRecord = db.prepare(`
    INSERT INTO municipal_records_fts (city_id, dataset, record_index, body)
    VALUES (?, ?, ?, ?)
  `);
  const markSynced = db.prepare(`
    INSERT INTO municipal_search_sync (city_id, dataset, succeeded_at)
    VALUES (?, ?, ?)
    ON CONFLICT(city_id, dataset) DO UPDATE SET succeeded_at = excluded.succeeded_at
  `);

  const liveKeys = new Set<string>();
  for (const row of cacheRows) {
    const key = `${row.city_id}\u0000${row.dataset}`;
    liveKeys.add(key);
    if (watermarks.get(key) === row.succeeded_at) continue;

    delIndex.run(row.city_id, row.dataset);
    let records: unknown[];
    try {
      const parsed = JSON.parse(row.records_json);
      records = Array.isArray(parsed) ? parsed : [];
    } catch {
      records = [];
    }
    records.forEach((rec, index) => {
      insertRecord.run(row.city_id, row.dataset, index, JSON.stringify(rec));
    });
    markSynced.run(row.city_id, row.dataset, row.succeeded_at);
  }

  // Cache rows that vanished must not keep leaking into search results.
  for (const key of watermarks.keys()) {
    if (liveKeys.has(key)) continue;
    const [cityId, dataset] = key.split('\u0000');
    delIndex.run(cityId, dataset);
    db.prepare(`DELETE FROM municipal_search_sync WHERE city_id = ? AND dataset = ?`).run(cityId, dataset);
  }
}

/**
 * FTS5 lookup for `/v1/municipal/search?q=`.
 *
 * Returns the matching record keys in canonical order (city_id, dataset,
 * record_index) so the route layer can drive keyset pagination straight off
 * this list. Returns `[]` for an empty/tokenless query and `null` when the DB
 * or FTS5 is unavailable (callers then fall back to "no results" — the route
 * is offline-first and never invents data).
 */
export function searchMunicipalRecordKeys(query: string): MunicipalSearchHit[] | null {
  const match = toFtsMatchQuery(query);
  if (!match) return [];

  const result = withCacheDb<MunicipalSearchHit[] | null>((db) => {
    try {
      syncSearchIndex(db);
      const rows = db.prepare(`
        SELECT city_id, dataset, record_index
        FROM municipal_records_fts
        WHERE municipal_records_fts MATCH ?
        ORDER BY city_id, dataset, record_index
      `).all(match) as Array<{ city_id: string; dataset: string; record_index: number }>;
      return rows.map((r) => ({
        cityId: r.city_id,
        dataset: r.dataset,
        recordIndex: r.record_index,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[MunicipalCache] FTS5 search failed (${msg}); search returns no results`);
      return null;
    }
  });
  return result ?? null;
}

export interface CoverageRow {
  cityId: string;
  dataset: string;
  source: string;
  recordCount: number;
  succeededAt: string;
  ageSeconds: number;
}

/**
 * Coverage view used by `/v1/municipal/coverage`. Returns every cached
 * (city, dataset) pair with age-in-seconds. Newest first — operators can
 * see at a glance which cities have fresh data and which are stale.
 */
export function loadMunicipalRecordCoverage(): CoverageRow[] {
  const result = withCacheReader<CoverageRow[]>((db) => {
    try {
      const rows = db.prepare(`
        SELECT city_id, dataset, source, record_count, succeeded_at
        FROM municipal_records_cache
        ORDER BY succeeded_at DESC
      `).all() as Array<{
        city_id: string;
        dataset: string;
        source: string;
        record_count: number;
        succeeded_at: string;
      }>;
      const now = Date.now();
      return rows.map((r) => ({
        cityId: r.city_id,
        dataset: r.dataset,
        source: r.source,
        recordCount: r.record_count,
        succeededAt: r.succeeded_at,
        ageSeconds: Math.round((now - new Date(r.succeeded_at).getTime()) / 1000),
      }));
    } catch {
      return [];
    }
  });
  return result ?? [];
}
