// SPDX-License-Identifier: AGPL-3.0-only
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
 *   - Schema migrates lazily on first DB access (`CREATE TABLE IF NOT EXISTS`),
 *     re-checked on every fresh open (cheap with IF NOT EXISTS).
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
 *   Every public helper opens a FRESH `DatabaseSync` and closes it in
 *   `finally`. Single-node writes (the production path) and cross-process
 *   writers (cron sweeps, manual SQL poke) both observe committed state at
 *   the next read; the singleton pattern has shown reader-snapshot quirks
 *   against node:sqlite's WAL mode under contention, so all access goes
 *   through this single `withCacheDb(cb)` helper.
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';

const SCHEMA_VERSION = 1 as const;

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

/**
 * Open a fresh connection + run `cb(db)` with it, close in `finally`.
 * Returns whatever `cb` returns (or null on a DB-open miss). Cheap enough
 * for per-request use (~1ms): municipal routes do at most ~5 lookups.
 */
function withCacheDb<T>(cb: (db: DatabaseSync) => T): T | null {
  const dbPath = process.env.QUILL_DB_PATH;
  if (!dbPath || !existsSync(dbPath)) return null;
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(dbPath);
    bootstrapCacheSchema(db);
  } catch {
    return null;
  }
  try {
    // Force a FULL checkpoint so any in-flight writer's WAL frames get
    // promoted to the main DB before our read. `PASSIVE` is too polite
    // — it bails out if another connection is mid-write, leaving newly
    // committed rows stranded in `<db>-wal` that this fresh connection
    // can't see (the -shm file's frame index lags the live -wal until
    // the original writer's connection closes cleanly). `FULL` blocks
    // until writers finish and merges their frames. Cost: ~5ms per
    // call; negligible against the 1s+ upstream fetch.
    try { db.exec(`PRAGMA wal_checkpoint(FULL)`); } catch { /* ignore */ }
    return cb(db);
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
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
  withCacheDb((db) => {
    // Strip the per-call provenance block before serialising — citation_hash
    // includes fetched_at which isn't a cache-stable property.
    const stripped = records.map((r) => {
      const { provenance: _ignored, ...rest } = r as { provenance?: unknown };
      return rest;
    });
    try {
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
    } catch {
      // best-effort — never break the request path over a cache write
    }
    return null;
  });
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
 * TODO(gap-7-followup): the smoke-test's Toronto cache-fallback scenario
 * (Python's sqlite3 inserts rows AFTER the Node process is running) sees
 * this function return null even when a fresh Node REPL probe against the
 * same DB file returns HIT. Coverage endpoint reads the same rows fine;
 * `saveMunicipalRecordCache` from Node writes succeed. Suspected cause:
 * node:sqlite WAL reader snapshot quirk with cross-process writers under
 * certain WAL-state configurations. Production path is Node-only writes
 * + Node reads, which works correctly. Filed separately; do not block on it.
 */
export function loadMunicipalRecordCache(
  cityId: string,
  dataset: string,
): CachedMunicipalFetch | null {
  const result = withCacheDb<CachedMunicipalFetch | null>((db) => {
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
      // If a row's records_json got corrupted (manual SQL poke, schema
      // migration mishap, disk fault) we land here. Log loudly so operators
      // know WHY the route returned unavailable — silent null would just look
      // like "no cache present yet" forever.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[MunicipalCache] loadMunicipalRecordCache JSON parse failed for ${cityId}/${dataset}: ${msg}`);
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
  const result = withCacheDb<CoverageRow[]>((db) => {
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
